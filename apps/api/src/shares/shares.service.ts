import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import {
  AuditAction,
  ErrorCode,
  type CreateShareRequest,
  type PublicSharePresentation,
  type ShareResourceType
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants';
import type { StorageProvider } from '../storage/storage.provider';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';
import { TenantSharePresentationService } from '../tenant-share-presentation/tenant-share-presentation.service';
import { canonicalMateCodeCandidates, parseCurrentMateCode } from '../products/breeding-rules';
import {
  calculateDaysSince,
  normalizeTaggedCode,
  parseTaggedProductEventNote,
  resolveNeedMatingStatus
} from '../products/product-event-utils';

type PublicShareQueryInput = {
  tenantId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  productId?: string;
  exp: string;
  sig: string;
};

type PublicShareAssetQueryInput = PublicShareQueryInput & {
  key: string;
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
    private readonly tenantSharePresentationService: TenantSharePresentationService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider
  ) {}

  async createShare(tenantId: string, actorUserId: string, payload: CreateShareRequest) {
    if (payload.resourceType !== 'tenant_feed') {
      throw new BadRequestException({
        message: `Unsupported resourceType: ${payload.resourceType}`,
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    if (payload.resourceId !== tenantId) {
      throw new BadRequestException({
        message: 'tenant_feed resourceId must match current tenant.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const resourceId = tenantId;
    const presentationOverride =
      this.tenantSharePresentationService.toSharePresentationOverrideJson(payload.presentationOverride);

    // Share creation no longer depends on subscription plan/quota.
    // We only require tenant subscription to be writable (ACTIVE).
    await this.tenantSubscriptionsService.assertTenantWritable(tenantId);

    const existingShare = await this.findShareByResource(tenantId, payload.resourceType, resourceId);

    let share =
      existingShare ??
      (await this.getOrCreateShare(
        tenantId,
        payload.resourceType,
        resourceId,
        null,
        actorUserId,
        presentationOverride
      ));

    if (existingShare && typeof presentationOverride !== 'undefined') {
      share = await this.prisma.publicShare.update({
        where: {
          id: existingShare.id
        },
        data: {
          presentationOverride
        }
      });
    }

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
        presentationOverride: true,
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

    const presentation = await this.tenantSharePresentationService.resolvePublicPresentation({
      tenantId: share.tenantId,
      tenantName: share.tenant.name,
      overrideRaw: share.presentationOverride
    });

    const response = await this.buildTenantFeedPublicShare(
      scopedShare,
      query.productId,
      expiresAt,
      presentation
    );
    await this.writeShareAccessAuditLog(scopedShare, expiresAt, 'data', meta, query.productId ?? null);

    return response;
  }

  async getPublicShareAsset(shareId: string, query: PublicShareAssetQueryInput, meta: ShareAccessMeta) {
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
        createdByUserId: true
      }
    });

    if (!share) {
      throw new NotFoundException({
        message: 'Share content not found.',
        errorCode: ErrorCode.ShareNotFound
      });
    }

    // Only allow managed keys; unmanaged URLs should be served as-is (not proxied).
    if (!this.isManagedStorageKey(share.tenantId, query.key)) {
      throw new NotFoundException({
        message: 'Share asset not found.',
        errorCode: ErrorCode.ShareNotFound
      });
    }

    const object = await this.storageProvider.getObject(query.key);

    await this.writeShareAccessAuditLog(
      {
        id: share.id,
        tenantId: share.tenantId,
        resourceType: this.parseShareResourceType(share.resourceType),
        resourceId: share.resourceId,
        productId: share.productId,
        createdByUserId: share.createdByUserId
      },
      expiresAt,
      'asset',
      meta
    );

    return {
      content: object.body,
      contentType: object.contentType,
      expiresAt
    };
  }

  private async buildTenantFeedPublicShare(
    share: ShareScope,
    detailProductId: string | undefined,
    expiresAt: Date,
    presentation: PublicSharePresentation
  ) {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId: share.tenantId,
        inStock: true
      },
      orderBy: [{ code: 'asc' }, { createdAt: 'desc' }],
      include: {
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 1
        }
      }
    });

    const items = await Promise.all(
      products.map(async (product) => {
        const coverImage = product.images[0] ?? null;
        const coverImageUrl = coverImage
          ? await this.resolvePublicImageUrl({
              shareId: share.id,
              tenantId: share.tenantId,
              resourceType: share.resourceType,
              resourceId: share.resourceId,
              key: coverImage.key,
              fallbackUrl: coverImage.url,
              expiresAt
            })
          : null;

        return {
          id: product.id,
          tenantId: product.tenantId,
          code: product.code,
          type: product.type?.trim() || 'breeder',
          name: product.name,
          description: product.description,
          seriesId: product.seriesId,
          sex: product.sex,
          offspringUnitPrice: product.offspringUnitPrice?.toNumber() ?? null,
          coverImageUrl,
          popularityScore: product.popularityScore ?? 0,
          isFeatured: product.isFeatured ?? false
        };
      })
    );

    let product = null;
    let detail = null;

    if (detailProductId) {
      const detailProduct = await this.prisma.product.findFirst({
        where: {
          id: detailProductId,
          tenantId: share.tenantId,
          inStock: true
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
            shareId: share.id,
            tenantId: share.tenantId,
            resourceType: share.resourceType,
            resourceId: share.resourceId,
            key: image.key,
            fallbackUrl: image.url,
            expiresAt
          }),
          contentType: image.contentType,
          sortOrder: image.sortOrder,
          isMain: image.isMain
        }))
      );

      if (!detailProduct) {
        throw new NotFoundException({
          message: 'Product not found in shared tenant feed.',
          errorCode: ErrorCode.ProductNotFound
        });
      }

      product = {
        id: detailProduct.id,
        tenantId: detailProduct.tenantId,
        code: detailProduct.code,
        type: detailProduct.type?.trim() || 'breeder',
        name: detailProduct.name,
        description: detailProduct.description,
        seriesId: detailProduct.seriesId,
        sex: detailProduct.sex,
        offspringUnitPrice: detailProduct?.offspringUnitPrice?.toNumber() ?? null,
        sireCode: detailProduct.sireCode,
        damCode: detailProduct.damCode,
        mateCode: detailProduct.mateCode,
        excludeFromBreeding: detailProduct?.excludeFromBreeding ?? false,
        hasSample: detailProduct?.hasSample ?? false,
        inStock: detailProduct?.inStock ?? true,
        popularityScore: detailProduct?.popularityScore ?? 0,
        isFeatured: detailProduct?.isFeatured ?? false,
        images
      };

      const [events, familyTree, maleMateLoad] = await Promise.all([
        this.listPublicProductEvents(share.tenantId, detailProduct.id),
        this.buildPublicProductFamilyTree(share.tenantId, detailProduct),
        this.buildPublicMaleMateLoad(share, detailProduct, expiresAt)
      ]);

      detail = {
        events,
        familyTree,
        maleMateLoad
      };
    }

    return {
      shareId: share.id,
      tenant: share.tenant,
      resourceType: 'tenant_feed' as const,
      presentation,
      items,
      product,
      detail,
      expiresAt: expiresAt.toISOString()
    };
  }

  private async listPublicProductEvents(tenantId: string, productId: string) {
    const events = await this.prisma.productEvent.findMany({
      where: {
        tenantId,
        productId
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    });

    return events.map((event) => {
      const parsedNote = parseTaggedProductEventNote(event.note);
      return {
        id: event.id,
        eventType: this.toPublicEventType(event.eventType, parsedNote),
        eventDate: event.eventDate?.toISOString?.() ?? null,
        maleCode: parsedNote.maleCode,
        eggCount: parsedNote.eggCount,
        note: parsedNote.note,
        oldMateCode: parsedNote.oldMateCode,
        newMateCode: parsedNote.newMateCode
      };
    });
  }

  private toPublicEventType(
    rawType: string,
    parsedNote: {
      oldMateCode: string | null;
      newMateCode: string | null;
    }
  ): 'mating' | 'egg' | 'change_mate' {
    const eventType = rawType.trim().toLowerCase();

    if (eventType === 'egg') {
      return 'egg';
    }

    if (eventType === 'change_mate' || eventType === 'change-mate') {
      return 'change_mate';
    }

    if (parsedNote.oldMateCode || parsedNote.newMateCode) {
      return 'change_mate';
    }

    return 'mating';
  }

  private async buildPublicProductFamilyTree(
    tenantId: string,
    detailProduct: {
      id: string;
      code: string;
      name: string | null;
      sex: string | null;
      sireCode: string | null;
      damCode: string | null;
      mateCode: string | null;
      description?: string | null;
    }
  ) {
    const currentMateCode = await this.resolveCurrentMateCode(tenantId, detailProduct);
    const [sire, dam, mate, children] = await Promise.all([
      this.findProductByCodeInsensitive(tenantId, detailProduct.sireCode),
      this.findProductByCodeInsensitive(tenantId, detailProduct.damCode),
      this.findProductByCodeCandidates(tenantId, canonicalMateCodeCandidates(currentMateCode)),
      this.prisma.product.findMany({
        where: {
          tenantId,
          OR: [
            {
              sireCode: {
                equals: detailProduct.code,
                mode: 'insensitive'
              }
            },
            {
              damCode: {
                equals: detailProduct.code,
                mode: 'insensitive'
              }
            }
          ]
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100
      })
    ]);

    return {
      self: this.toPublicFamilyTreeNode(detailProduct),
      sire: this.toPublicFamilyTreeNodeOrNull(sire),
      dam: this.toPublicFamilyTreeNodeOrNull(dam),
      mate: this.toPublicFamilyTreeNodeOrNull(mate),
      children: children.map((item) => this.toPublicFamilyTreeNode(item)),
      links: {
        sire: this.toPublicFamilyTreeLink(detailProduct.sireCode, sire),
        dam: this.toPublicFamilyTreeLink(detailProduct.damCode, dam),
        mate: this.toPublicFamilyTreeLink(currentMateCode, mate)
      },
      limitations:
        'Product family-tree currently includes self, immediate sire/dam/mate, and direct children only.'
    };
  }

  private async findProductByCodeInsensitive(tenantId: string, code: string | null) {
    const normalized = code?.trim();
    if (!normalized) {
      return null;
    }

    return this.prisma.product.findFirst({
      where: {
        tenantId,
        code: {
          equals: normalized,
          mode: 'insensitive'
        }
      }
    });
  }

  private async findProductByCodeCandidates(tenantId: string, candidates: string[]) {
    for (const candidate of candidates) {
      const found = await this.findProductByCodeInsensitive(tenantId, candidate);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private async resolveCurrentMateCode(
    tenantId: string,
    product: {
      id: string;
      mateCode: string | null;
      description?: string | null;
    }
  ): Promise<string | null> {
    const explicit = normalizeTaggedCode(product.mateCode ?? '');
    if (explicit) {
      return explicit;
    }

    const parsedFromDescription = normalizeTaggedCode(parseCurrentMateCode(product.description));
    if (parsedFromDescription) {
      return parsedFromDescription;
    }

    const latestMatingEvent = await this.prisma.productEvent.findFirst({
      where: {
        tenantId,
        productId: product.id,
        eventType: 'mating'
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    });

    const parsed = parseTaggedProductEventNote(latestMatingEvent?.note ?? null);
    return normalizeTaggedCode(parsed.maleCode);
  }

  private toPublicFamilyTreeNode(product: { id: string; code: string; name: string | null; sex: string | null }) {
    return {
      id: product.id,
      code: product.code,
      name: product.name,
      sex: product.sex
    };
  }

  private toPublicFamilyTreeNodeOrNull(
    product: { id: string; code: string; name: string | null; sex: string | null } | null
  ) {
    if (!product) {
      return null;
    }

    return this.toPublicFamilyTreeNode(product);
  }

  private toPublicFamilyTreeLink(
    code: string | null,
    product: { id: string; code: string; name: string | null; sex: string | null } | null
  ) {
    if (!code || !code.trim()) {
      return null;
    }

    return {
      code: code.trim(),
      product: this.toPublicFamilyTreeNodeOrNull(product)
    };
  }

  private async buildPublicMaleMateLoad(
    share: ShareScope,
    detailProduct: {
      id: string;
      code: string;
      sex: string | null;
    },
    expiresAt: Date
  ) {
    const tenantId = share.tenantId;
    if (detailProduct.sex?.trim().toLowerCase() !== 'male') {
      return [];
    }

    const mateCodeCandidates = canonicalMateCodeCandidates(detailProduct.code);
    const femaleProducts = await this.prisma.product.findMany({
      where: {
        tenantId,
        inStock: true,
        sex: {
          equals: 'female',
          mode: 'insensitive'
        },
        OR: mateCodeCandidates.map((candidate) => ({
          mateCode: {
            equals: candidate,
            mode: 'insensitive'
          }
        }))
      },
      include: {
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 1
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    const mapped = await Promise.all(
      femaleProducts.map(async (female) => {
        const [lastEggEvent, lastMatingWithMaleEvent, lastMatingEvent] = await Promise.all([
          this.prisma.productEvent.findFirst({
            where: {
              tenantId,
              productId: female.id,
              eventType: 'egg'
            },
            orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
          }),
          this.prisma.productEvent.findFirst({
            where: {
              tenantId,
              productId: female.id,
              eventType: 'mating',
              OR: mateCodeCandidates.map((candidate) => ({
                note: {
                  contains: `#maleCode=${candidate}`,
                  mode: 'insensitive'
                }
              }))
            },
            orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
          }),
          this.prisma.productEvent.findFirst({
            where: {
              tenantId,
              productId: female.id,
              eventType: 'mating'
            },
            orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
          })
        ]);

        const lastEggAt = lastEggEvent?.eventDate ?? null;
        const lastMatingAt = lastMatingEvent?.eventDate ?? null;
        const lastMatingWithThisMaleAt = lastMatingWithMaleEvent?.eventDate ?? null;
        const daysSinceEgg = calculateDaysSince(lastEggAt);
        const status = resolveNeedMatingStatus(lastEggAt, lastMatingAt, female.excludeFromBreeding);

        const mainImage = female.images[0] ?? null;
        const femaleMainImageUrl = mainImage
          ? await this.resolvePublicImageUrl({
              shareId: share.id,
              tenantId,
              resourceType: share.resourceType,
              resourceId: share.resourceId,
              key: mainImage.key,
              fallbackUrl: mainImage.url,
              expiresAt
            })
          : null;

        return {
          femaleId: female.id,
          femaleCode: female.code,
          femaleMainImageUrl,
          femaleThumbnailUrl: femaleMainImageUrl,
          lastEggAt: lastEggAt ? lastEggAt.toISOString() : null,
          lastMatingWithThisMaleAt: lastMatingWithThisMaleAt ? lastMatingWithThisMaleAt.toISOString() : null,
          daysSinceEgg,
          status,
          excludeFromBreeding: female.excludeFromBreeding
        };
      })
    );

    return mapped;
  }

  private buildPublicShareAssetPath(input: {
    shareId: string;
    tenantId: string;
    resourceType: ShareResourceType;
    resourceId: string;
    exp: string;
    sig: string;
    key: string;
  }): string {
    const params = new URLSearchParams();
    params.set('tenantId', input.tenantId);
    params.set('resourceType', input.resourceType);
    params.set('resourceId', input.resourceId);
    params.set('exp', input.exp);
    params.set('sig', input.sig);
    params.set('key', input.key);

    return `/shares/${input.shareId}/public/assets?${params.toString()}`;
  }

  private async resolvePublicImageUrl(input: {
    shareId: string;
    tenantId: string;
    resourceType: ShareResourceType;
    resourceId: string;
    key: string;
    fallbackUrl: string;
    expiresAt: Date;
  }): Promise<string> {
    if (!this.isManagedStorageKey(input.tenantId, input.key)) {
      return input.fallbackUrl;
    }

    const exp = Math.floor(input.expiresAt.getTime() / 1000).toString();
    const sig = this.signPayload({
      shareId: input.shareId,
      tenantId: input.tenantId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      exp
    });

    return this.buildPublicShareAssetPath({
      shareId: input.shareId,
      tenantId: input.tenantId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      exp,
      sig,
      key: input.key
    });
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

  private parseShareResourceType(value: string): ShareResourceType {
    if (value === 'tenant_feed') {
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
