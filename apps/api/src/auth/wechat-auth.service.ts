import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ErrorCode, type CreateWechatAuthorizeUrlResponse } from '@eggturtle/shared';

import { PrismaService } from '../prisma.service';

type WechatOauthState = {
  userId: string;
  tenantId: string;
  exp: number;
  returnPathHash: string;
};

type HandleWechatCallbackInput = {
  code?: string;
  state?: string;
  returnPath?: string;
};

const WECHAT_OAUTH_SCOPE = 'snsapi_base';
const WECHAT_AUTH_SUCCESS = 'success';
const WECHAT_AUTH_FAILED = 'failed';
const WECHAT_AUTH_CONFLICT = 'conflict';
const DEFAULT_WEB_BASE_URL = 'http://localhost:30010';
const DEFAULT_API_BASE_URL = 'http://localhost:30011';
const STATE_TTL_SECONDS = 10 * 60;

@Injectable()
export class WechatAuthService {
  constructor(private readonly prisma: PrismaService) {}

  createAuthorizeUrl(
    userId: string,
    tenantId: string,
    returnPath: string,
  ): CreateWechatAuthorizeUrlResponse {
    this.assertConfigured();
    this.assertReturnPath(returnPath);

    const state = this.buildState(userId, tenantId, returnPath);
    const callbackUrl = new URL('/auth/wechat/callback', this.resolveApiPublicBaseUrl());
    callbackUrl.searchParams.set('returnPath', returnPath);

    const authorizeUrl = new URL('https://open.weixin.qq.com/connect/oauth2/authorize');
    authorizeUrl.searchParams.set('appid', this.getWechatAppId());
    authorizeUrl.searchParams.set('redirect_uri', callbackUrl.toString());
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', WECHAT_OAUTH_SCOPE);
    authorizeUrl.searchParams.set('state', state.token);

    return {
      authorizeUrl: `${authorizeUrl.toString()}#wechat_redirect`,
      expiresAt: new Date(state.expiresAt * 1000).toISOString(),
    };
  }

  async handleCallback(input: HandleWechatCallbackInput): Promise<string> {
    const fallbackUrl = this.buildRedirectUrl('/login', WECHAT_AUTH_FAILED);

    try {
      this.assertConfigured();
      const returnPath = this.normalizeReturnPath(input.returnPath);
      const state = this.verifyState(input.state, returnPath);

      if (!input.code) {
        return this.buildRedirectUrl(returnPath, WECHAT_AUTH_FAILED);
      }

      const openId = await this.exchangeCodeForOpenId(input.code);
      const appId = this.getWechatAppId();
      const existingBinding = await this.prisma.userWechatBinding.findUnique({
        where: {
          appId_openId: {
            appId,
            openId,
          },
        },
        select: {
          userId: true,
        },
      });

      if (existingBinding && existingBinding.userId !== state.userId) {
        return this.buildRedirectUrl(returnPath, WECHAT_AUTH_CONFLICT);
      }

      await this.prisma.userWechatBinding.upsert({
        where: {
          userId_appId: {
            userId: state.userId,
            appId,
          },
        },
        create: {
          userId: state.userId,
          appId,
          openId,
        },
        update: {
          openId,
        },
      });

      return this.buildRedirectUrl(returnPath, WECHAT_AUTH_SUCCESS);
    } catch (error) {
      if (error instanceof ConflictException) {
        return this.buildRedirectUrl(input.returnPath ?? '/login', WECHAT_AUTH_CONFLICT);
      }

      return fallbackUrl;
    }
  }

  private async exchangeCodeForOpenId(code: string): Promise<string> {
    const endpoint = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    endpoint.searchParams.set('appid', this.getWechatAppId());
    endpoint.searchParams.set('secret', this.getWechatAppSecret());
    endpoint.searchParams.set('code', code);
    endpoint.searchParams.set('grant_type', 'authorization_code');

    const response = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as
      | { openid?: string; errcode?: number; errmsg?: string }
      | null;

    if (!response.ok || !payload?.openid) {
      throw new ServiceUnavailableException({
        message: payload?.errmsg ?? 'Failed to exchange WeChat OAuth code.',
        errorCode: ErrorCode.ApiUnavailable,
      });
    }

    return payload.openid;
  }

  private assertConfigured(): void {
    if (!this.getWechatAppId() || !this.getWechatAppSecret()) {
      throw new ServiceUnavailableException({
        message: 'WeChat OAuth is not configured.',
        errorCode: ErrorCode.ApiUnavailable,
      });
    }
  }

  private buildState(userId: string, tenantId: string, returnPath: string) {
    const expiresAt = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS;
    const returnPathHash = this.hashReturnPath(returnPath);
    const payload = `${userId}.${tenantId}.${expiresAt}.${returnPathHash}`;
    const signature = createHmac('sha256', this.getStateSecret()).update(payload).digest('base64url');

    return {
      token: `${payload}.${signature}`,
      expiresAt,
    };
  }

  private verifyState(stateToken: string | undefined, returnPath: string): WechatOauthState {
    if (!stateToken) {
      throw new BadRequestException({
        message: 'Missing WeChat OAuth state.',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    const segments = stateToken.split('.');
    if (segments.length !== 5) {
      throw new BadRequestException({
        message: 'Invalid WeChat OAuth state.',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    const [userId, tenantId, expRaw, returnPathHash, signature] = segments;
    const exp = Number(expRaw);

    if (!userId || !tenantId || !Number.isFinite(exp) || !returnPathHash || !signature) {
      throw new BadRequestException({
        message: 'Invalid WeChat OAuth state.',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    const payload = `${userId}.${tenantId}.${exp}.${returnPathHash}`;
    const expectedSignature = createHmac('sha256', this.getStateSecret())
      .update(payload)
      .digest('base64url');

    if (!this.safeEqual(signature, expectedSignature)) {
      throw new BadRequestException({
        message: 'Invalid WeChat OAuth state signature.',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    if (exp <= Math.floor(Date.now() / 1000)) {
      throw new BadRequestException({
        message: 'WeChat OAuth state is expired.',
        errorCode: ErrorCode.ExpiredCode,
      });
    }

    if (returnPathHash !== this.hashReturnPath(returnPath)) {
      throw new BadRequestException({
        message: 'WeChat OAuth return path mismatch.',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    return {
      userId,
      tenantId,
      exp,
      returnPathHash,
    };
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private hashReturnPath(returnPath: string): string {
    return createHash('sha256').update(returnPath).digest('hex').slice(0, 16);
  }

  private buildRedirectUrl(rawReturnPath: string, status: string): string {
    const returnPath = this.normalizeReturnPath(rawReturnPath);
    const redirectUrl = new URL(returnPath, this.resolveWebPublicBaseUrl());
    redirectUrl.searchParams.set('wechatAuth', status);
    return redirectUrl.toString();
  }

  private normalizeReturnPath(returnPath?: string): string {
    const normalized = returnPath?.trim() || '/login';
    this.assertReturnPath(normalized);
    return normalized;
  }

  private assertReturnPath(returnPath: string): void {
    if (!returnPath.startsWith('/')) {
      throw new BadRequestException({
        message: 'returnPath must start with /.',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }

    if (!returnPath.startsWith('/app/') && returnPath !== '/login') {
      throw new BadRequestException({
        message: 'returnPath must target /app/* or /login.',
        errorCode: ErrorCode.InvalidRequestPayload,
      });
    }
  }

  private resolveApiPublicBaseUrl(): string {
    const value = process.env.API_PUBLIC_BASE_URL?.trim();
    if (value) {
      return value.replace(/\/+$/, '');
    }

    return DEFAULT_API_BASE_URL;
  }

  private resolveWebPublicBaseUrl(): string {
    const value = (process.env.WEB_PUBLIC_BASE_URL ?? process.env.API_PUBLIC_BASE_URL)?.trim();
    if (value) {
      return value.replace(/\/+$/, '');
    }

    return DEFAULT_WEB_BASE_URL;
  }

  private getStateSecret(): string {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException({
        message: 'JWT secret is required for WeChat OAuth state.',
        errorCode: ErrorCode.ApiUnavailable,
      });
    }

    return secret;
  }

  private getWechatAppId(): string {
    return process.env.PAYMENT_WECHAT_APP_ID?.trim() ?? '';
  }

  private getWechatAppSecret(): string {
    return process.env.WECHAT_MP_APP_SECRET?.trim() ?? '';
  }
}
