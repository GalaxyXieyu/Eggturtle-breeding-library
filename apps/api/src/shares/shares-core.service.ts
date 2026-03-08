import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { AuditAction, ErrorCode, type ShareResourceType } from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { resolveAllowedMaxEdge } from '../images/image-variants';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma.service';

import type { ShareAccessMeta, ShareAuditScope } from './shares.types';

const DEFAULT_WEB_PUBLIC_BASE_URL = 'http://localhost:30010';
const DEFAULT_API_PUBLIC_BASE_URL = 'http://localhost:30011';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 20;

@Injectable()
export class SharesCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  buildShareEntryUrl(shareToken: string, requestOrigin?: string | null): string {
    const apiBaseUrl = this.resolvePublicBaseUrl(
      process.env.API_PUBLIC_BASE_URL,
      requestOrigin,
      DEFAULT_API_PUBLIC_BASE_URL
    );
    return new URL(`/s/${shareToken}`, apiBaseUrl).toString();
  }

  buildRedirectUrl(
    payload: {
      id: string;
      tenantId: string;
      tenantSlug: string;
      shareToken: string;
      resourceType: ShareResourceType;
      resourceId: string;
    },
    requestOrigin?: string | null
  ): { redirectUrl: string; expiresAt: Date } {
    const ttlSeconds = this.getSignedUrlTtlSeconds();
    const nowSeconds = Math.floor(Date.now() / 1000);
    // Align expiry to a fixed TTL boundary so entry URLs stay stable within the same window.
    const expiresAtSeconds = Math.ceil((nowSeconds + 1) / ttlSeconds) * ttlSeconds;
    const expiresAt = new Date(expiresAtSeconds * 1000);
    const exp = expiresAtSeconds.toString();

    const signature = this.signPayload({
      shareId: payload.id,
      tenantId: payload.tenantId,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      exp
    });

    const webBaseUrl = this.resolvePublicBaseUrl(
      process.env.WEB_PUBLIC_BASE_URL,
      requestOrigin,
      DEFAULT_WEB_PUBLIC_BASE_URL
    );
    const redirectPath = `/public/s/${payload.shareToken}`;

    const redirectUrl = new URL(redirectPath, webBaseUrl);
    redirectUrl.searchParams.set('sid', payload.id);
    redirectUrl.searchParams.set('tenantId', payload.tenantId);
    redirectUrl.searchParams.set('resourceType', payload.resourceType);
    redirectUrl.searchParams.set('resourceId', payload.resourceId);
    redirectUrl.searchParams.set('exp', exp);
    redirectUrl.searchParams.set('sig', signature);

    return {
      redirectUrl: redirectUrl.toString(),
      expiresAt
    };
  }

  private resolvePublicBaseUrl(configuredBaseUrl: string | undefined, requestOrigin: string | null | undefined, fallback: string): string {
    const configured = configuredBaseUrl?.trim();
    if (configured) {
      return configured.replace(/\/+$/, '');
    }

    const origin = requestOrigin?.trim();
    if (origin) {
      return origin.replace(/\/+$/, '');
    }

    return fallback;
  }

  verifySignature(payload: {
    shareId: string;
    tenantId: string;
    resourceType: ShareResourceType;
    resourceId: string;
    exp: string;
    sig: string;
  }): Date {
    const expiresAtSeconds = Number(payload.exp);
    if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds <= 0) {
      throw new BadRequestException({
        message: 'Invalid share signature expiry.',
        errorCode: ErrorCode.ShareSignatureInvalid
      });
    }

    const expiresAt = new Date(expiresAtSeconds * 1000);
    if (expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        message: 'Share signature expired.',
        errorCode: ErrorCode.ShareSignatureExpired
      });
    }

    const expected = this.signPayload({
      shareId: payload.shareId,
      tenantId: payload.tenantId,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      exp: payload.exp
    });

    if (!this.safeCompareSignature(expected, payload.sig)) {
      throw new UnauthorizedException({
        message: 'Invalid share signature.',
        errorCode: ErrorCode.ShareSignatureInvalid
      });
    }

    return expiresAt;
  }

  signPayload(payload: {
    shareId: string;
    tenantId: string;
    resourceType: ShareResourceType;
    resourceId: string;
    exp: string;
  }): string {
    const signingSecret = process.env.PUBLIC_SHARE_SIGNING_SECRET?.trim();

    if (!signingSecret) {
      throw new Error('PUBLIC_SHARE_SIGNING_SECRET is required for public share signatures.');
    }

    const value = [
      payload.shareId,
      payload.tenantId,
      payload.resourceType,
      payload.resourceId,
      payload.exp
    ].join('.');

    return createHmac('sha256', signingSecret).update(value).digest('hex');
  }

  buildPublicShareAssetPath(input: {
    shareId: string;
    tenantId: string;
    resourceType: ShareResourceType;
    resourceId: string;
    exp: string;
    sig: string;
    key: string;
    maxEdge?: number;
  }): string {
    const params = new URLSearchParams();
    params.set('tenantId', input.tenantId);
    params.set('resourceType', input.resourceType);
    params.set('resourceId', input.resourceId);
    params.set('exp', input.exp);
    params.set('sig', input.sig);
    params.set('key', input.key);

    const allowedMaxEdge = resolveAllowedMaxEdge(input.maxEdge);
    if (allowedMaxEdge) {
      params.set('maxEdge', allowedMaxEdge.toString());
    }

    return `/shares/${input.shareId}/public/assets?${params.toString()}`;
  }

  async findShareByResource(tenantId: string, resourceType: ShareResourceType, resourceId: string) {
    return this.prisma.publicShare.findFirst({
      where: {
        tenantId,
        resourceType,
        resourceId
      }
    });
  }

  async getOrCreateShare(
    tenantId: string,
    resourceType: ShareResourceType,
    resourceId: string,
    productId: string | null,
    actorUserId: string,
    presentationOverride: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined
  ) {
    const existing = await this.findShareByResource(tenantId, resourceType, resourceId);

    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.publicShare.create({
        data: {
          tenantId,
          resourceType,
          resourceId,
          productId,
          presentationOverride,
          createdByUserId: actorUserId,
          shareToken: this.generateShareToken()
        }
      });
    } catch (error) {
      if (!this.isShareResourceUniqueConflict(error)) {
        throw error;
      }

      const conflictShare = await this.findShareByResource(tenantId, resourceType, resourceId);

      if (conflictShare) {
        return conflictShare;
      }

      throw error;
    }
  }

  parseShareResourceType(value: string): ShareResourceType {
    if (value === 'tenant_feed') {
      return value;
    }

    throw new BadRequestException({
      message: `Unsupported resourceType: ${value}`,
      errorCode: ErrorCode.InvalidRequestPayload
    });
  }

  isManagedStorageKey(tenantId: string, key: string): boolean {
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    return normalizedKey.startsWith(`${tenantId}/`);
  }

  async writeShareAccessAuditLog(
    share: ShareAuditScope,
    expiresAt: Date,
    phase: 'entry' | 'data' | 'asset',
    meta: ShareAccessMeta,
    requestedProductId?: string | null
  ) {
    await this.auditLogsService.createLog({
      tenantId: share.tenantId,
      actorUserId: share.createdByUserId,
      action: AuditAction.ShareAccess,
      resourceType: 'public_share',
      resourceId: share.id,
      metadata: {
        resourceType: share.resourceType,
        resourceId: share.resourceId,
        productId: share.productId,
        requestedProductId: requestedProductId ?? null,
        phase,
        expiresAt: expiresAt.toISOString(),
        ip: meta.ip,
        userAgent: meta.userAgent,
        shareToken: share.shareToken ?? null
      }
    });
  }

  getRateLimitWindowMs(): number {
    const rawValue = process.env.PUBLIC_SHARE_ENTRY_RATE_LIMIT_WINDOW_MS;
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_RATE_LIMIT_WINDOW_MS;
    }

    return Math.floor(parsed);
  }

  getRateLimitMaxRequests(): number {
    const rawValue = process.env.PUBLIC_SHARE_ENTRY_RATE_LIMIT_MAX;
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_RATE_LIMIT_MAX_REQUESTS;
    }

    return Math.floor(parsed);
  }

  throwEntryRateLimited(): never {
    throw new HttpException(
      {
        message: 'Too many share entry requests. Please retry later.',
        errorCode: ErrorCode.Forbidden
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private generateShareToken(): string {
    return `shr_${randomBytes(18).toString('base64url')}`;
  }

  private safeCompareSignature(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  private getSignedUrlTtlSeconds(): number {
    const rawValue = process.env.PUBLIC_SHARE_SIGNED_URL_TTL_SECONDS;
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_SIGNED_URL_TTL_SECONDS;
    }

    return Math.floor(parsed);
  }

  private isShareResourceUniqueConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    const byResource =
      target.includes('tenant_id') && target.includes('resource_type') && target.includes('resource_id');
    const byProduct = target.includes('tenant_id') && target.includes('product_id');

    return byResource || byProduct;
  }
}
