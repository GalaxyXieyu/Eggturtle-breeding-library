import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { AuditAction, ErrorCode, type CreateShareRequest, type ShareResourceType } from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants';
import type { StorageProvider } from '../storage/storage.provider';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

type PublicShareQueryInput = {
  tenantId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  exp: string;
  sig: string;
};

type ShareAccessMeta = {
  ip: string | null;
  userAgent: string | null;
};

const DEFAULT_WEB_PUBLIC_BASE_URL = 'http://localhost:30010';
const DEFAULT_API_PUBLIC_BASE_URL = 'http://localhost:30011';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 20;

@Injectable()
export class SharesService {
  private readonly entryRequests = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider
  ) {}

  async createShare(tenantId: string, actorUserId: string, payload: CreateShareRequest) {
    if (payload.resourceType !== 'product') {
      throw new BadRequestException({
        message: `Unsupported resourceType: ${payload.resourceType}`,
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id: payload.resourceId,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!product) {
      throw new NotFoundException({
        message: 'Product not found.',
        errorCode: ErrorCode.ProductNotFound
      });
    }

    await this.tenantSubscriptionsService.assertSharePlanAllowsCreate(tenantId);

    const existingShare = await this.prisma.publicShare.findUnique({
      where: {
        tenantId_productId: {
          tenantId,
          productId: product.id
        }
      }
    });

    if (!existingShare) {
      await this.tenantSubscriptionsService.assertShareQuotaAllowsCreate(tenantId);
    }

    const share = existingShare ?? (await this.getOrCreateProductShare(tenantId, product.id, actorUserId));

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ShareCreate,
      resourceType: 'public_share',
      resourceId: share.id,
      metadata: {
        shareToken: share.shareToken,
        productId: share.productId
      }
    });

    return {
      id: share.id,
      tenantId: share.tenantId,
      resourceType: 'product' as const,
      resourceId: share.productId,
      shareToken: share.shareToken,
      entryUrl: this.buildShareEntryUrl(share.shareToken),
      createdAt: share.createdAt.toISOString(),
      updatedAt: share.updatedAt.toISOString()
    };
  }

  async resolveShareEntry(shareToken: string, meta: ShareAccessMeta) {
    this.assertEntryRateLimit(shareToken, meta.ip);

    const share = await this.prisma.publicShare.findUnique({
      where: {
        shareToken
      },
      select: {
        id: true,
        tenantId: true,
        productId: true,
        createdByUserId: true,
        shareToken: true
      }
    });

    if (!share) {
      throw new NotFoundException({
        message: 'Share link not found.',
        errorCode: ErrorCode.ShareNotFound
      });
    }

    const { redirectUrl, expiresAt } = this.buildRedirectUrl({
      id: share.id,
      tenantId: share.tenantId,
      productId: share.productId
    });

    await this.writeShareAccessAuditLog(share, expiresAt, 'entry', meta);

    return {
      statusCode: 302,
      redirectUrl
    };
  }

  async getPublicShare(shareId: string, query: PublicShareQueryInput, meta: ShareAccessMeta) {
    const expiresAt = this.verifySignature({
      shareId,
      tenantId: query.tenantId,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      exp: query.exp,
      sig: query.sig
    });

    const share = await this.prisma.publicShare.findFirst({
      where: {
        id: shareId,
        tenantId: query.tenantId,
        productId: query.resourceId
      },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        },
        product: {
          include: {
            images: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
            }
          }
        }
      }
    });

    if (!share) {
      throw new NotFoundException({
        message: 'Share content not found.',
        errorCode: ErrorCode.ShareNotFound
      });
    }

    const images = await Promise.all(
      share.product.images.map(async (image) => ({
        id: image.id,
        tenantId: image.tenantId,
        productId: image.productId,
        key: image.key,
        url: await this.resolvePublicImageUrl({
          tenantId: share.tenantId,
          key: image.key,
          fallbackUrl: image.url,
          expiresAt
        }),
        contentType: image.contentType,
        sortOrder: image.sortOrder,
        isMain: image.isMain
      }))
    );

    await this.writeShareAccessAuditLog(share, expiresAt, 'data', meta);

    return {
      shareId: share.id,
      tenant: {
        id: share.tenant.id,
        slug: share.tenant.slug,
        name: share.tenant.name
      },
      resourceType: 'product' as const,
      product: {
        id: share.product.id,
        tenantId: share.product.tenantId,
        code: share.product.code,
        name: share.product.name,
        description: share.product.description,
        images
      },
      expiresAt: expiresAt.toISOString()
    };
  }

  private async resolvePublicImageUrl(input: {
    tenantId: string;
    key: string;
    fallbackUrl: string;
    expiresAt: Date;
  }): Promise<string> {
    if (!this.isManagedStorageKey(input.tenantId, input.key)) {
      return input.fallbackUrl;
    }

    const ttlSeconds = Math.max(1, Math.ceil((input.expiresAt.getTime() - Date.now()) / 1000));
    return this.storageProvider.getSignedUrl(input.key, ttlSeconds);
  }

  private async getOrCreateProductShare(tenantId: string, productId: string, actorUserId: string) {
    const existing = await this.prisma.publicShare.findUnique({
      where: {
        tenantId_productId: {
          tenantId,
          productId
        }
      }
    });

    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.publicShare.create({
        data: {
          tenantId,
          productId,
          createdByUserId: actorUserId,
          shareToken: this.generateShareToken()
        }
      });
    } catch (error) {
      if (!this.isProductShareUniqueConflict(error)) {
        throw error;
      }

      const conflictShare = await this.prisma.publicShare.findUnique({
        where: {
          tenantId_productId: {
            tenantId,
            productId
          }
        }
      });

      if (conflictShare) {
        return conflictShare;
      }

      throw error;
    }
  }

  private buildShareEntryUrl(shareToken: string): string {
    const apiBaseUrl = process.env.API_PUBLIC_BASE_URL ?? DEFAULT_API_PUBLIC_BASE_URL;
    return new URL(`/s/${shareToken}`, apiBaseUrl).toString();
  }

  private buildRedirectUrl(payload: {
    id: string;
    tenantId: string;
    productId: string;
  }): { redirectUrl: string; expiresAt: Date } {
    const ttlSeconds = this.getSignedUrlTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const exp = Math.floor(expiresAt.getTime() / 1000).toString();

    const signature = this.signPayload({
      shareId: payload.id,
      tenantId: payload.tenantId,
      resourceType: 'product',
      resourceId: payload.productId,
      exp
    });

    const webBaseUrl = process.env.WEB_PUBLIC_BASE_URL ?? DEFAULT_WEB_PUBLIC_BASE_URL;
    const redirectUrl = new URL('/public/share', webBaseUrl);
    redirectUrl.searchParams.set('sid', payload.id);
    redirectUrl.searchParams.set('tenantId', payload.tenantId);
    redirectUrl.searchParams.set('resourceType', 'product');
    redirectUrl.searchParams.set('resourceId', payload.productId);
    redirectUrl.searchParams.set('exp', exp);
    redirectUrl.searchParams.set('sig', signature);

    return {
      redirectUrl: redirectUrl.toString(),
      expiresAt
    };
  }

  private verifySignature(payload: {
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

  private signPayload(payload: {
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

  private getRateLimitWindowMs(): number {
    const rawValue = process.env.PUBLIC_SHARE_ENTRY_RATE_LIMIT_WINDOW_MS;
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_RATE_LIMIT_WINDOW_MS;
    }

    return Math.floor(parsed);
  }

  private getRateLimitMaxRequests(): number {
    const rawValue = process.env.PUBLIC_SHARE_ENTRY_RATE_LIMIT_MAX;
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_RATE_LIMIT_MAX_REQUESTS;
    }

    return Math.floor(parsed);
  }

  private assertEntryRateLimit(shareToken: string, ip: string | null): void {
    const now = Date.now();
    const windowMs = this.getRateLimitWindowMs();
    const maxRequests = this.getRateLimitMaxRequests();
    const key = `${shareToken}:${ip ?? 'unknown'}`;

    const recent = (this.entryRequests.get(key) ?? []).filter((timestamp) => now - timestamp <= windowMs);

    if (recent.length >= maxRequests) {
      throw new HttpException(
        {
          message: 'Too many share entry requests. Please retry later.',
          errorCode: ErrorCode.Forbidden
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    recent.push(now);
    this.entryRequests.set(key, recent);

    // TODO: replace this in-memory limiter with a distributed limiter for multi-instance deployments.
    if (this.entryRequests.size > 2000) {
      const cutoff = now - windowMs;
      for (const [storedKey, timestamps] of this.entryRequests.entries()) {
        const filtered = timestamps.filter((timestamp) => timestamp >= cutoff);
        if (filtered.length === 0) {
          this.entryRequests.delete(storedKey);
        } else {
          this.entryRequests.set(storedKey, filtered);
        }
      }
    }
  }

  private async writeShareAccessAuditLog(
    share: {
      id: string;
      tenantId: string;
      productId: string;
      createdByUserId: string;
      shareToken?: string;
    },
    expiresAt: Date,
    phase: 'entry' | 'data',
    meta: ShareAccessMeta
  ) {
    await this.auditLogsService.createLog({
      tenantId: share.tenantId,
      actorUserId: share.createdByUserId,
      action: AuditAction.ShareAccess,
      resourceType: 'public_share',
      resourceId: share.id,
      metadata: {
        productId: share.productId,
        phase,
        expiresAt: expiresAt.toISOString(),
        ip: meta.ip,
        userAgent: meta.userAgent,
        shareToken: share.shareToken ?? null
      }
    });
  }

  private isManagedStorageKey(tenantId: string, key: string): boolean {
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    return normalizedKey.startsWith(`${tenantId}/`);
  }

  private isProductShareUniqueConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    return target.includes('tenant_id') && target.includes('product_id');
  }
}
