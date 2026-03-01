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
  productId?: string;
  exp: string;
  sig: string;
};

type ShareAccessMeta = {
  ip: string | null;
  userAgent: string | null;
};

type ShareAuditScope = {
  id: string;
  tenantId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  productId: string | null;
  createdByUserId: string;
  shareToken?: string;
};

type ShareScope = ShareAuditScope & {
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
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
    let resourceId = payload.resourceId;
    let productId: string | null = null;

    if (payload.resourceType === 'product') {
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

      resourceId = product.id;
      productId = product.id;
    } else if (payload.resourceType === 'tenant_feed') {
      if (payload.resourceId !== tenantId) {
        throw new BadRequestException({
          message: 'tenant_feed resourceId must match current tenant.',
          errorCode: ErrorCode.InvalidRequestPayload
        });
      }

      resourceId = tenantId;
    } else {
      throw new BadRequestException({
        message: `Unsupported resourceType: ${payload.resourceType}`,
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    await this.tenantSubscriptionsService.assertSharePlanAllowsCreate(tenantId);

    const existingShare = await this.findShareByResource(tenantId, payload.resourceType, resourceId);

    if (!existingShare) {
      await this.tenantSubscriptionsService.assertShareQuotaAllowsCreate(tenantId);
    }

    const share =
      existingShare ??
      (await this.getOrCreateShare(tenantId, payload.resourceType, resourceId, productId, actorUserId));

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ShareCreate,
      resourceType: 'public_share',
      resourceId: share.id,
      metadata: {
        shareToken: share.shareToken,
        resourceType: share.resourceType,
        resourceId: share.resourceId,
        productId: share.productId
      }
    });

    return {
      id: share.id,
      tenantId: share.tenantId,
      resourceType: share.resourceType,
      resourceId: share.resourceId,
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
        resourceType: true,
        resourceId: true,
        productId: true,
        createdByUserId: true,
        shareToken: true,
        tenant: {
          select: {
            slug: true
          }
        }
      }
    });

    if (!share) {
      throw new NotFoundException({
        message: 'Share link not found.',
        errorCode: ErrorCode.ShareNotFound
      });
    }

    const resourceType = this.parseShareResourceType(share.resourceType);

    const { redirectUrl, expiresAt } = this.buildRedirectUrl({
      id: share.id,
      tenantId: share.tenantId,
      tenantSlug: share.tenant.slug,
      shareToken: share.shareToken,
      resourceType,
      resourceId: share.resourceId
    });

    await this.writeShareAccessAuditLog(
      {
        id: share.id,
        tenantId: share.tenantId,
        resourceType,
        resourceId: share.resourceId,
        productId: share.productId,
        createdByUserId: share.createdByUserId,
        shareToken: share.shareToken
      },
      expiresAt,
      'entry',
      meta
    );

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
        resourceType: query.resourceType,
        resourceId: query.resourceId
      },
      select: {
        id: true,
        tenantId: true,
        resourceType: true,
        resourceId: true,
        productId: true,
        createdByUserId: true,
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true
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

    const resourceType = this.parseShareResourceType(share.resourceType);

    const scopedShare: ShareScope = {
      id: share.id,
      tenantId: share.tenantId,
      tenant: share.tenant,
      resourceType,
      resourceId: share.resourceId,
      productId: share.productId,
      createdByUserId: share.createdByUserId
    };

    if (resourceType === 'product') {
      const response = await this.buildProductPublicShare(scopedShare, expiresAt);
      await this.writeShareAccessAuditLog(scopedShare, expiresAt, 'data', meta);
      return response;
    }

    const response = await this.buildTenantFeedPublicShare(scopedShare, query.productId, expiresAt);
    await this.writeShareAccessAuditLog(scopedShare, expiresAt, 'data', meta, query.productId ?? null);

    return response;
  }

  private async buildProductPublicShare(share: ShareScope, expiresAt: Date) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: share.resourceId,
        tenantId: share.tenantId
      },
      include: {
        images: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
        }
      }
    });

    if (!product) {
      throw new NotFoundException({
        message: 'Share content not found.',
        errorCode: ErrorCode.ShareNotFound
      });
    }

    const images = await Promise.all(
      product.images.map(async (image) => ({
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

    return {
      shareId: share.id,
      tenant: share.tenant,
      resourceType: 'product' as const,
      product: {
        id: product.id,
        tenantId: product.tenantId,
        code: product.code,
        name: product.name,
        description: product.description,
        seriesId: product.seriesId,
        sex: product.sex,
        offspringUnitPrice: product.offspringUnitPrice?.toNumber() ?? null,
        sireCode: product.sireCode,
        damCode: product.damCode,
        mateCode: product.mateCode,
        excludeFromBreeding: product.excludeFromBreeding,
        hasSample: product.hasSample,
        inStock: product.inStock,
        popularityScore: product.popularityScore,
        isFeatured: product.isFeatured,
        images
      },
      expiresAt: expiresAt.toISOString()
    };
  }

  private async buildTenantFeedPublicShare(share: ShareScope, detailProductId: string | undefined, expiresAt: Date) {
    // Transitional strategy: tenant_feed is breeder-first for domain correctness,
    // while product remains the image/share carrier.
    const breeders = await this.prisma.breeder.findMany({
      where: {
        tenantId: share.tenantId,
        isActive: true
      },
      orderBy: [{ code: 'asc' }, { createdAt: 'desc' }]
    });

    const breederCodes = [...new Set(breeders.map((item) => item.code.trim()).filter((value) => value.length > 0))];

    const feedProducts =
      breederCodes.length === 0
        ? []
        : await this.prisma.product.findMany({
            where: {
              tenantId: share.tenantId,
              code: {
                in: breederCodes
              }
            },
            include: {
              images: {
                orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
                take: 1
              }
            }
          });

    const productByCode = new Map<string, (typeof feedProducts)[number]>();
    for (const item of feedProducts) {
      const codeKey = this.normalizeCodeKey(item.code);
      if (codeKey) {
        productByCode.set(codeKey, item);
      }
    }

    const items = await Promise.all(
      breeders.map(async (breeder) => {
        const codeKey = this.normalizeCodeKey(breeder.code);
        const linkedProduct = codeKey ? productByCode.get(codeKey) ?? null : null;
        const coverImage = linkedProduct?.images[0] ?? null;
        const coverImageUrl = coverImage
          ? await this.resolvePublicImageUrl({
              tenantId: share.tenantId,
              key: coverImage.key,
              fallbackUrl: coverImage.url,
              expiresAt
            })
          : null;

        return {
          id: breeder.id,
          tenantId: breeder.tenantId,
          code: breeder.code,
          name: breeder.name,
          description: breeder.description,
          seriesId: breeder.seriesId,
          sex: breeder.sex,
          offspringUnitPrice: linkedProduct?.offspringUnitPrice?.toNumber() ?? null,
          coverImageUrl,
          popularityScore: linkedProduct?.popularityScore ?? 0,
          isFeatured: linkedProduct?.isFeatured ?? false
        };
      })
    );

    let product = null;

    if (detailProductId) {
      const detailBreeder = await this.prisma.breeder.findFirst({
        where: {
          id: detailProductId,
          tenantId: share.tenantId
        }
      });

      if (!detailBreeder) {
        throw new NotFoundException({
          message: 'Breeder not found in shared tenant feed.',
          errorCode: ErrorCode.BreederNotFound
        });
      }

      const detailProduct = await this.prisma.product.findFirst({
        where: {
          tenantId: share.tenantId,
          code: {
            equals: detailBreeder.code,
            mode: 'insensitive'
          }
        },
        include: {
          images: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
          }
        }
      });

      const images = await Promise.all(
        (detailProduct?.images ?? []).map(async (image) => ({
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

      product = {
        id: detailBreeder.id,
        tenantId: detailBreeder.tenantId,
        code: detailBreeder.code,
        name: detailBreeder.name,
        description: detailBreeder.description,
        seriesId: detailBreeder.seriesId,
        sex: detailBreeder.sex,
        offspringUnitPrice: detailProduct?.offspringUnitPrice?.toNumber() ?? null,
        sireCode: detailBreeder.sireCode,
        damCode: detailBreeder.damCode,
        mateCode: detailBreeder.mateCode,
        excludeFromBreeding: detailProduct?.excludeFromBreeding ?? false,
        hasSample: detailProduct?.hasSample ?? false,
        inStock: detailProduct?.inStock ?? true,
        popularityScore: detailProduct?.popularityScore ?? 0,
        isFeatured: detailProduct?.isFeatured ?? false,
        images
      };
    }

    return {
      shareId: share.id,
      tenant: share.tenant,
      resourceType: 'tenant_feed' as const,
      items,
      product,
      expiresAt: expiresAt.toISOString()
    };
  }

  private normalizeCodeKey(code: string | null | undefined): string | null {
    const normalized = code?.trim();
    if (!normalized) {
      return null;
    }

    return normalized.toUpperCase();
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

  private async findShareByResource(tenantId: string, resourceType: ShareResourceType, resourceId: string) {
    return this.prisma.publicShare.findFirst({
      where: {
        tenantId,
        resourceType,
        resourceId
      }
    });
  }

  private async getOrCreateShare(
    tenantId: string,
    resourceType: ShareResourceType,
    resourceId: string,
    productId: string | null,
    actorUserId: string
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

  private buildShareEntryUrl(shareToken: string): string {
    const apiBaseUrl = process.env.API_PUBLIC_BASE_URL ?? DEFAULT_API_PUBLIC_BASE_URL;
    return new URL(`/s/${shareToken}`, apiBaseUrl).toString();
  }

  private buildRedirectUrl(payload: {
    id: string;
    tenantId: string;
    tenantSlug: string;
    shareToken: string;
    resourceType: ShareResourceType;
    resourceId: string;
  }): { redirectUrl: string; expiresAt: Date } {
    const ttlSeconds = this.getSignedUrlTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const exp = Math.floor(expiresAt.getTime() / 1000).toString();

    const signature = this.signPayload({
      shareId: payload.id,
      tenantId: payload.tenantId,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      exp
    });

    const webBaseUrl = process.env.WEB_PUBLIC_BASE_URL ?? DEFAULT_WEB_PUBLIC_BASE_URL;
    const redirectPath =
      payload.resourceType === 'tenant_feed'
        ? `/public/s/${payload.shareToken}`
        : `/public/s/${payload.shareToken}/products/${payload.resourceId}`;

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
    share: ShareAuditScope,
    expiresAt: Date,
    phase: 'entry' | 'data',
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

  private parseShareResourceType(value: string): ShareResourceType {
    if (value === 'product' || value === 'tenant_feed') {
      return value;
    }

    throw new BadRequestException({
      message: `Unsupported resourceType: ${value}`,
      errorCode: ErrorCode.InvalidRequestPayload
    });
  }

  private isManagedStorageKey(tenantId: string, key: string): boolean {
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    return normalizedKey.startsWith(`${tenantId}/`);
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
