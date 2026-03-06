import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';
import { Prisma } from '@prisma/client';

import { resolveAllowedMaxEdge, resizeToWebpMaxEdge } from '../images/image-variants';

import { canonicalMateCodeCandidates, parseCurrentMateCode } from '../products/breeding-rules';
import {
  calculateDaysSince,
  normalizeTaggedCode,
  parseTaggedProductEventNote,
  resolveNeedMatingStatus
} from '../products/product-event-utils';
import { PrismaService } from '../prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants';
import type { StorageProvider } from '../storage/storage.provider';
import { TenantSharePresentationService } from '../tenant-share-presentation/tenant-share-presentation.service';

import { SharesCoreService } from './shares-core.service';
import type {
  PublicShareAssetQueryInput,
  PublicShareQueryInput,
  ShareAccessMeta,
  ShareScope
} from './shares.types';

@Injectable()
export class SharesPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantSharePresentationService: TenantSharePresentationService,
    private readonly sharesCoreService: SharesCoreService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider
  ) {}

  async getPublicShare(shareId: string, query: PublicShareQueryInput, meta: ShareAccessMeta) {
    const expiresAt = this.sharesCoreService.verifySignature({
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

    const resourceType = this.sharesCoreService.parseShareResourceType(share.resourceType);

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
    await this.sharesCoreService.writeShareAccessAuditLog(scopedShare, expiresAt, 'data', meta, query.productId ?? null);

    return response;
  }

  async getPublicShareAsset(shareId: string, query: PublicShareAssetQueryInput, meta: ShareAccessMeta) {
    const expiresAt = this.sharesCoreService.verifySignature({
      shareId,
      tenantId: query.tenantId,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      exp: query.exp,
      sig: query.sig
    });

    const maxEdge = resolveAllowedMaxEdge(query.maxEdge);

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

    if (!this.sharesCoreService.isManagedStorageKey(share.tenantId, query.key)) {
      throw new NotFoundException({
        message: 'Share asset not found.',
        errorCode: ErrorCode.ShareNotFound
      });
    }

    const object = await this.storageProvider.getObject(query.key);

    const resized = maxEdge ? await resizeToWebpMaxEdge({ body: object.body, maxEdge }) : null;

    await this.sharesCoreService.writeShareAccessAuditLog(
      {
        id: share.id,
        tenantId: share.tenantId,
        resourceType: this.sharesCoreService.parseShareResourceType(share.resourceType),
        resourceId: share.resourceId,
        productId: share.productId,
        createdByUserId: share.createdByUserId
      },
      expiresAt,
      'asset',
      meta
    );

    return {
      content: resized?.body ?? object.body,
      contentType: resized?.contentType ?? object.contentType,
      expiresAt
    };
  }

  private async buildTenantFeedPublicShare(
    share: ShareScope,
    detailProductId: string | undefined,
    expiresAt: Date,
    presentation: Awaited<ReturnType<TenantSharePresentationService['resolvePublicPresentation']>>
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

    const needMatingSummaryByProductId = await this.loadNeedMatingSummaryByProductIds(
      share.tenantId,
      products.map((product) => product.id)
    );

    const items = await Promise.all(
      products.map(async (product) => {
        const coverImage = product.images[0] ?? null;
        const needMatingSummary = needMatingSummaryByProductId.get(product.id);
        const coverImageUrl = coverImage
          ? await this.resolvePublicImageUrl({
              shareId: share.id,
              tenantId: share.tenantId,
              resourceType: share.resourceType,
              resourceId: share.resourceId,
              key: coverImage.key,
              fallbackUrl: coverImage.url,
              expiresAt,
              maxEdge: 480
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
          needMatingStatus: needMatingSummary?.status ?? null,
          lastEggAt: needMatingSummary?.lastEggAt?.toISOString() ?? null,
          lastMatingAt: needMatingSummary?.lastMatingAt?.toISOString() ?? null,
          daysSinceEgg: needMatingSummary?.daysSinceEgg ?? null,
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
            expiresAt,
            maxEdge: 960
          }),
          contentType: image.contentType,
          sizeBytes: image.sizeBytes.toString(),
          sortOrder: image.sortOrder,
          isMain: image.isMain,
          createdAt: image.createdAt.toISOString(),
          updatedAt: image.updatedAt.toISOString()
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

  private async loadNeedMatingSummaryByProductIds(tenantId: string, productIds: string[]) {
    const summaryByProductId = new Map<
      string,
      {
        status: 'normal' | 'need_mating' | 'warning';
        lastEggAt: Date | null;
        lastMatingAt: Date | null;
        daysSinceEgg: number | null;
      }
    >();

    if (productIds.length === 0) {
      return summaryByProductId;
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        productId: string;
        excludeFromBreeding: boolean;
        lastEggAt: Date | null;
        lastMatingAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT
        p.id AS "productId",
        p.exclude_from_breeding AS "excludeFromBreeding",
        MAX(CASE WHEN e.event_type = 'egg' THEN e.event_date END) AS "lastEggAt",
        MAX(CASE WHEN e.event_type = 'mating' THEN e.event_date END) AS "lastMatingAt"
      FROM "products" p
      LEFT JOIN "product_events" e
        ON e.tenant_id = p.tenant_id
       AND e.product_id = p.id
      WHERE p.tenant_id = ${tenantId}
        AND p.id IN (${Prisma.join(productIds)})
        AND LOWER(COALESCE(p.sex, '')) = 'female'
      GROUP BY p.id, p.exclude_from_breeding
    `);

    for (const row of rows) {
      const status = resolveNeedMatingStatus(row.lastEggAt, row.lastMatingAt, row.excludeFromBreeding);
      summaryByProductId.set(row.productId, {
        status,
        lastEggAt: row.lastEggAt,
        lastMatingAt: row.lastMatingAt,
        daysSinceEgg: calculateDaysSince(row.lastEggAt)
      });
    }

    return summaryByProductId;
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
        '当前家族谱系仅展示自己、直属父母、当前配偶与直系子代。'
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
              expiresAt,
              maxEdge: 960
            })
          : null;

        const femaleThumbnailUrl = mainImage
          ? await this.resolvePublicImageUrl({
              shareId: share.id,
              tenantId,
              resourceType: share.resourceType,
              resourceId: share.resourceId,
              key: mainImage.key,
              fallbackUrl: mainImage.url,
              expiresAt,
              maxEdge: 480
            })
          : null;

        return {
          femaleId: female.id,
          femaleCode: female.code,
          femaleMainImageUrl,
          femaleThumbnailUrl,
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

  private async resolvePublicImageUrl(input: {
    shareId: string;
    tenantId: string;
    resourceType: 'tenant_feed';
    resourceId: string;
    key: string;
    fallbackUrl: string;
    expiresAt: Date;
    maxEdge?: number;
  }): Promise<string> {
    if (!this.sharesCoreService.isManagedStorageKey(input.tenantId, input.key)) {
      return input.fallbackUrl;
    }

    const exp = Math.floor(input.expiresAt.getTime() / 1000).toString();
    const sig = this.sharesCoreService.signPayload({
      shareId: input.shareId,
      tenantId: input.tenantId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      exp
    });

    return this.sharesCoreService.buildPublicShareAssetPath({
      shareId: input.shareId,
      tenantId: input.tenantId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      exp,
      sig,
      key: input.key,
      maxEdge: input.maxEdge
    });
  }
}
