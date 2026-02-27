import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';
import type {
  AuthUser,
  RequestCodeResponse,
  SwitchTenantRequest,
  SwitchTenantResponse,
  VerifyCodeResponse
} from '@eggturtle/shared';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../prisma.service';

import { JwtTokenService } from './jwt-token.service';

export type AuthContext = {
  user: AuthUser;
  tenantId?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService
  ) {}

  async requestCode(email: string): Promise<RequestCodeResponse> {
    const code = this.generateCode();
    const salt = randomBytes(16).toString('hex');
    const codeHash = this.hashCode(code, salt);
    const ttlMinutes = Number(process.env.AUTH_CODE_TTL_MINUTES ?? 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.prisma.authCode.create({
      data: {
        email,
        codeHash,
        salt,
        expiresAt
      }
    });

    const shouldExposeDevCode = this.isDevCodeEnabled();
    if (shouldExposeDevCode) {
      console.info('[Auth v0] request-code', {
        email,
        code,
        expiresAt: expiresAt.toISOString()
      });
    }

    return {
      ok: true,
      expiresAt: expiresAt.toISOString(),
      ...(shouldExposeDevCode ? { devCode: code } : {})
    };
  }

  async verifyCode(email: string, code: string): Promise<VerifyCodeResponse> {
    const latestCode = await this.prisma.authCode.findFirst({
      where: {
        email,
        consumedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latestCode) {
      this.throwInvalidCode();
    }

    const now = new Date();
    if (latestCode.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedException({
        message: 'Code is expired.',
        errorCode: ErrorCode.ExpiredCode
      });
    }

    const hashedCode = this.hashCode(code, latestCode.salt);
    if (!this.isHashEqual(hashedCode, latestCode.codeHash)) {
      this.throwInvalidCode();
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.authCode.updateMany({
        where: {
          id: latestCode.id,
          consumedAt: null
        },
        data: {
          consumedAt: now
        }
      });

      if (consumed.count !== 1) {
        this.throwInvalidCode();
      }

      return tx.user.upsert({
        where: { email },
        update: {},
        create: { email }
      });
    });

    const accessToken = this.issueAccessToken({
      id: user.id,
      email: user.email
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  async switchTenant(user: AuthUser, payload: SwitchTenantRequest): Promise<SwitchTenantResponse> {
    const tenant = payload.tenantId
      ? await this.prisma.tenant.findUnique({
          where: {
            id: payload.tenantId
          }
        })
      : await this.prisma.tenant.findUnique({
          where: {
            slug: payload.slug!
          }
        });

    if (!tenant) {
      throw new NotFoundException({
        message: 'Tenant not found.',
        errorCode: ErrorCode.TenantNotFound
      });
    }

    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id
        }
      }
    });

    if (!membership) {
      throw new ForbiddenException({
        message: 'User is not a member of this tenant.',
        errorCode: ErrorCode.NotTenantMember
      });
    }

    return {
      accessToken: this.issueAccessToken(user, tenant.id),
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name
      },
      role: membership.role
    };
  }

  async getAuthContextFromAccessToken(token: string): Promise<AuthContext | null> {
    const payload = this.jwtTokenService.verify(token);
    if (!payload) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub
      }
    });

    if (!user) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tenantId: payload.tenantId
    };
  }

  async getUserFromAccessToken(token: string): Promise<AuthUser | null> {
    const context = await this.getAuthContextFromAccessToken(token);
    return context?.user ?? null;
  }

  private isDevCodeEnabled(): boolean {
    return process.env.NODE_ENV === 'development' && process.env.AUTH_DEV_CODE_ENABLED === 'true';
  }

  private issueAccessToken(user: Pick<AuthUser, 'id' | 'email'>, tenantId?: string): string {
    const tokenExpiresInSeconds = Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 7 * 24 * 60 * 60);

    return this.jwtTokenService.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId
      },
      tokenExpiresInSeconds
    );
  }

  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private hashCode(code: string, salt: string): string {
    const pepper = process.env.AUTH_CODE_PEPPER ?? '';
    return createHash('sha256').update(`${salt}:${code}:${pepper}`).digest('hex');
  }

  private isHashEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private throwInvalidCode(): never {
    throw new UnauthorizedException({
      message: 'Code is invalid.',
      errorCode: ErrorCode.InvalidCode
    });
  }
}
