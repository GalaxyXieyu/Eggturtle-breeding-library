import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditAction, ErrorCode } from '@eggturtle/shared';
import type {
  CreateProductRequest,
  ListProductsPublicClicksQuery,
  ListProductsQuery,
  Product,
  ProductEvent,
  ProductFamilyTree,
  ProductFamilyTreeLink,
  ProductPublicClicksItem,
  ProductPublicClicksSummary,
  ProductImage,
  ReorderProductImagesRequest
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import type {
  Product as PrismaProduct,
  ProductEvent as PrismaProductEvent,
  ProductImage as PrismaProductImage
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants';
import type { StorageProvider } from '../storage/storage.provider';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';
import {
  buildTaggedNote,
  canonicalMateCodeCandidates,
  normalizeCodeUpper,
  parseCurrentMateCode,
  parseEventDateInput,
  processPairTransitionDescription
} from './breeding-rules';

export type UploadedBinaryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export type ProductImageContentResult =
  | {
      content: Buffer;
      contentType: string | null;
    }
  | {
      redirectUrl: string;
      contentType: string | null;
    };

export type UpdateProductInput = Partial<CreateProductRequest>;

export type CreateMatingRecordInput = {
  femaleProductId: string;
  maleProductId: string;
  eventDate: string;
  note?: string | null;
};

export type CreateEggRecordInput = {
  femaleProductId: string;
  eventDate: string;
  eggCount?: number | null;
  note?: string | null;
};

export type CreateProductEventInput = {
  eventType: 'mating' | 'egg' | 'change_mate';
  eventDate: string;
  maleCode?: string | null;
  eggCount?: number | null;
  note?: string | null;
  oldMateCode?: string | null;
  newMateCode?: string | null;
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider
  ) {}

  private readonly naturalCodeCollator = new Intl.Collator('zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base'
  });

  async createProduct(
    tenantId: string,
    actorUserId: string,
    payload: CreateProductRequest
  ): Promise<Product> {
    await this.tenantSubscriptionsService.assertProductCreateAllowed(tenantId);
    const normalizedCode = this.normalizeRequiredCode(payload.code);
    const existingByCode = await this.prisma.product.findFirst({
      where: {
        tenantId,
        code: {
          equals: normalizedCode,
          mode: 'insensitive'
        }
      },
      select: {
        id: true
      }
    });

    if (existingByCode) {
      throw new ConflictException('Product code already exists in this tenant.');
    }

    if (payload.offspringUnitPrice !== null && payload.offspringUnitPrice !== undefined) {
      const resolvedSex = this.normalizeOptionalSex(payload.sex);
      if (resolvedSex !== 'female') {
        throw new BadRequestException('offspringUnitPrice is only allowed for female breeders.');
      }
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          tenantId,
          code: normalizedCode,
          type: this.normalizeOptionalText(payload.type) ?? 'breeder',
          name: this.normalizeOptionalText(payload.name) ?? normalizedCode,
          description: this.normalizeOptionalText(payload.description),
          seriesId: this.normalizeOptionalText(payload.seriesId),
          sex: this.normalizeOptionalSex(payload.sex),
          offspringUnitPrice: payload.offspringUnitPrice ?? null,
          sireCode: this.normalizeOptionalCode(payload.sireCode),
          damCode: this.normalizeOptionalCode(payload.damCode),
          mateCode: this.normalizeOptionalCode(payload.mateCode),
          excludeFromBreeding: payload.excludeFromBreeding ?? false,
          hasSample: payload.hasSample ?? false,
          inStock: payload.inStock ?? true,
          popularityScore: payload.popularityScore ?? 0,
          isFeatured: payload.isFeatured ?? false
        }
      });

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductCreate,
        resourceType: 'product',
        resourceId: product.id,
        metadata: {
          code: product.code,
          name: product.name
        }
      });

      return this.toProduct(product);
    } catch (error) {
      if (this.isProductCodeConflict(error)) {
        throw new ConflictException('Product code already exists in this tenant.');
      }

      throw error;
    }
  }

  async updateProduct(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: UpdateProductInput
  ): Promise<Product> {
    const product = await this.findProductOrThrow(tenantId, productId);
    const updateData: Prisma.ProductUncheckedUpdateInput = {};

    const resolvedSex =
      payload.sex === undefined
        ? this.normalizeOptionalSex(product.sex)
        : this.normalizeOptionalSex(payload.sex);

    if (payload.offspringUnitPrice !== undefined && payload.offspringUnitPrice !== null && resolvedSex !== 'female') {
      throw new BadRequestException('offspringUnitPrice is only allowed for female breeders.');
    }

    if (payload.code !== undefined) {
      const nextCode = this.normalizeRequiredCode(payload.code);
      const existingByCode = await this.prisma.product.findFirst({
        where: {
          tenantId,
          id: {
            not: product.id
          },
          code: {
            equals: nextCode,
            mode: 'insensitive'
          }
        },
        select: {
          id: true
        }
      });

      if (existingByCode) {
        throw new ConflictException('Product code already exists in this tenant.');
      }

      updateData.code = nextCode;
    }

    if (payload.type !== undefined) {
      updateData.type = this.normalizeOptionalText(payload.type) ?? 'breeder';
    }

    if (payload.name !== undefined) {
      updateData.name = this.normalizeOptionalText(payload.name);
    }

    if (payload.description !== undefined) {
      updateData.description = processPairTransitionDescription(
        product.description,
        this.normalizeOptionalText(payload.description)
      );
    }

    if (payload.seriesId !== undefined) {
      updateData.seriesId = this.normalizeOptionalText(payload.seriesId);
    }

    if (payload.sex !== undefined) {
      updateData.sex = resolvedSex;
    }

    if (payload.offspringUnitPrice !== undefined) {
      updateData.offspringUnitPrice = payload.offspringUnitPrice ?? null;
    }

    if (payload.sireCode !== undefined) {
      updateData.sireCode = this.normalizeOptionalCode(payload.sireCode);
    }

    if (payload.damCode !== undefined) {
      updateData.damCode = this.normalizeOptionalCode(payload.damCode);
    }

    if (payload.mateCode !== undefined) {
      updateData.mateCode = this.normalizeOptionalCode(payload.mateCode);
    }

    if (payload.excludeFromBreeding !== undefined) {
      updateData.excludeFromBreeding = payload.excludeFromBreeding;
    }

    if (payload.hasSample !== undefined) {
      updateData.hasSample = payload.hasSample;
    }

    if (payload.inStock !== undefined) {
      updateData.inStock = payload.inStock;
    }

    if (payload.popularityScore !== undefined) {
      updateData.popularityScore = payload.popularityScore;
    }

    if (payload.isFeatured !== undefined) {
      updateData.isFeatured = payload.isFeatured;
    }

    if (payload.sex !== undefined && resolvedSex !== 'female') {
      updateData.offspringUnitPrice = null;
    }

    const previousMateCode = normalizeCodeUpper(product.mateCode);
    const nextMateCode =
      payload.mateCode === undefined ? previousMateCode : this.normalizeOptionalCode(payload.mateCode);
    const mateCodeChanged = previousMateCode !== nextMateCode;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const updatedProduct = await tx.product.update({
          where: {
            id: product.id
          },
          data: updateData
        });

        if (mateCodeChanged && (resolvedSex ?? '').toLowerCase() === 'female') {
          await tx.productEvent.create({
            data: {
              tenantId,
              productId: updatedProduct.id,
              eventType: 'change_mate',
              eventDate: new Date(),
              note: buildTaggedNote('自动记录：配偶变更', {
                oldMateCode: previousMateCode,
                newMateCode: nextMateCode
              })
            }
          });
        }

        return updatedProduct;
      });

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductUpdate,
        resourceType: 'product',
        resourceId: updated.id,
        metadata: {
          previousMateCode,
          nextMateCode
        }
      });

      return this.toProduct(updated);
    } catch (error) {
      if (this.isProductCodeConflict(error)) {
        throw new ConflictException('Product code already exists in this tenant.');
      }

      throw error;
    }
  }

  async createMatingRecord(
    tenantId: string,
    actorUserId: string,
    payload: CreateMatingRecordInput
  ): Promise<ProductEvent> {
    const female = await this.findProductOrThrow(tenantId, payload.femaleProductId);
    const male = await this.findProductOrThrow(tenantId, payload.maleProductId);

    this.assertFemaleProduct(female, 'femaleProductId');
    this.assertMaleProduct(male, 'maleProductId');
    this.assertSameSeries(female, male);

    const eventDate = this.parseEventDate(payload.eventDate);
    const maleCode = this.normalizeRequiredCode(male.code);
    const note = buildTaggedNote(payload.note, {
      maleCode
    });

    const event = await this.prisma.productEvent.create({
      data: {
        tenantId,
        productId: female.id,
        eventType: 'mating',
        eventDate,
        note
      }
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductEventCreate,
      resourceType: 'product_event',
      resourceId: event.id,
      metadata: {
        eventType: event.eventType,
        femaleProductId: female.id,
        maleProductId: male.id
      }
    });

    return this.toProductEvent(event);
  }

  async createEggRecord(
    tenantId: string,
    actorUserId: string,
    payload: CreateEggRecordInput
  ): Promise<ProductEvent> {
    const female = await this.findProductOrThrow(tenantId, payload.femaleProductId);
    this.assertFemaleProduct(female, 'femaleProductId');

    const eventDate = this.parseEventDate(payload.eventDate);
    const eggCount = payload.eggCount ?? null;
    const note = buildTaggedNote(payload.note, {
      eggCount: eggCount ?? undefined
    });

    const event = await this.prisma.productEvent.create({
      data: {
        tenantId,
        productId: female.id,
        eventType: 'egg',
        eventDate,
        note
      }
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductEventCreate,
      resourceType: 'product_event',
      resourceId: event.id,
      metadata: {
        eventType: event.eventType,
        femaleProductId: female.id,
        eggCount
      }
    });

    return this.toProductEvent(event);
  }

  async createProductEvent(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: CreateProductEventInput
  ): Promise<ProductEvent> {
    const product = await this.findProductOrThrow(tenantId, productId);
    this.assertFemaleProduct(product, 'productId');

    const eventDate = this.parseEventDate(payload.eventDate);
    const maleCode =
      payload.eventType === 'mating'
        ? this.normalizeOptionalCode(payload.maleCode) ?? this.normalizeOptionalCode(product.mateCode)
        : this.normalizeOptionalCode(payload.maleCode);

    const note = buildTaggedNote(payload.note, {
      maleCode,
      eggCount: payload.eggCount ?? undefined,
      oldMateCode: this.normalizeOptionalCode(payload.oldMateCode),
      newMateCode: this.normalizeOptionalCode(payload.newMateCode)
    });

    const event = await this.prisma.productEvent.create({
      data: {
        tenantId,
        productId: product.id,
        eventType: payload.eventType,
        eventDate,
        note
      }
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductEventCreate,
      resourceType: 'product_event',
      resourceId: event.id,
      metadata: {
        eventType: payload.eventType,
        productId
      }
    });

    return this.toProductEvent(event);
  }

  async listProducts(tenantId: string, query: ListProductsQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const exactCode = query.code?.trim();
    const keyword = query.search?.trim();
    const productType = query.type?.trim();
    const sex = query.sex?.trim();
    const seriesId = query.seriesId?.trim();
    const sortDir: Prisma.SortOrder = query.sortDir ?? 'desc';

    const where: Prisma.ProductWhereInput = {
      tenantId
    };

    if (keyword) {
      where.OR = [
        {
          code: {
            contains: keyword,
            mode: 'insensitive'
          }
        },
        {
          name: {
            contains: keyword,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: keyword,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (exactCode) {
      where.code = {
        equals: exactCode,
        mode: 'insensitive'
      };
    }

    if (sex) {
      where.sex = {
        equals: sex,
        mode: 'insensitive'
      };
    }

    if (productType) {
      where.type = {
        equals: productType,
        mode: 'insensitive'
      };
    }

    if (seriesId) {
      where.seriesId = {
        equals: seriesId,
        mode: 'insensitive'
      };
    }

    const include = {
      images: {
        where: {
          isMain: true
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: 1,
        select: {
          id: true
        }
      }
    } satisfies Prisma.ProductInclude;

    let items: Array<
      PrismaProduct & {
        images: Array<{ id: string }>;
      }
    > = [];
    let total = 0;

    if (query.sortBy === 'code') {
      const all = await this.prisma.product.findMany({
        where,
        include
      });
      all.sort((left, right) => this.compareProductCode(left.code, right.code, sortDir));
      total = all.length;
      items = all.slice(skip, skip + query.pageSize);
    } else {
      const [pagedItems, countedTotal] = await Promise.all([
        this.prisma.product.findMany({
          where,
          include,
          orderBy: {
            updatedAt: sortDir
          },
          skip,
          take: query.pageSize
        }),
        this.prisma.product.count({
          where
        })
      ]);
      items = pagedItems;
      total = countedTotal;
    }

    return {
      products: items.map((item) =>
        this.toProduct(item, {
          coverImageUrl: item.images[0] ? this.buildImageAccessPath(item.id, item.images[0].id) : null
        })
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    };
  }

  async getProductByCode(tenantId: string, code: string): Promise<Product> {
    const normalizedCode = code.trim();
    const product = await this.prisma.product.findFirst({
      where: {
        tenantId,
        code: {
          equals: normalizedCode,
          mode: 'insensitive'
        }
      },
      include: {
        images: {
          where: {
            isMain: true
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 1,
          select: {
            id: true
          }
        }
      }
    });

    if (!product) {
      throw new NotFoundException({
        message: 'Product not found.',
        errorCode: ErrorCode.ProductNotFound
      });
    }

    return this.toProduct(product, {
      coverImageUrl: product.images[0] ? this.buildImageAccessPath(product.id, product.images[0].id) : null
    });
  }

  async getProductById(tenantId: string, productId: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId
      },
      include: {
        images: {
          where: {
            isMain: true
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 1,
          select: {
            id: true
          }
        }
      }
    });

    if (!product) {
      throw new NotFoundException({
        message: 'Product not found.',
        errorCode: ErrorCode.ProductNotFound
      });
    }

    return this.toProduct(product, {
      coverImageUrl: product.images[0] ? this.buildImageAccessPath(product.id, product.images[0].id) : null
    });
  }

  async getProductPublicClicks(
    tenantId: string,
    productId: string,
    days: number
  ): Promise<ProductPublicClicksSummary> {
    await this.findProductOrThrow(tenantId, productId);

    const since = this.getSinceDate(days);
    const rows = await this.prisma.$queryRaw<
      Array<{ ip: string | null; userAgent: string | null; createdAt: Date }>
    >(Prisma.sql`
      SELECT
        metadata->>'ip' AS "ip",
        metadata->>'userAgent' AS "userAgent",
        "created_at" AS "createdAt"
      FROM "audit_logs"
      WHERE "tenant_id" = ${tenantId}
        AND "action" = ${AuditAction.ShareAccess}
        AND "resource_type" = 'public_share'
        AND "created_at" >= ${since}
        AND metadata->>'phase' = 'data'
        AND metadata->>'requestedProductId' = ${productId}
      ORDER BY "created_at" DESC
    `);

    const visitorKeys = new Set(rows.map((row) => this.buildVisitorKey(row.ip, row.userAgent)));

    return {
      productId,
      totalClicks: rows.length,
      uniqueVisitors: visitorKeys.size,
      days,
      lastClickedAt: rows[0]?.createdAt ? rows[0].createdAt.toISOString() : null
    };
  }

  async listProductPublicClicks(
    tenantId: string,
    query: ListProductsPublicClicksQuery
  ): Promise<{ days: number; items: ProductPublicClicksItem[] }> {
    const since = this.getSinceDate(query.days);
    const rows = await this.prisma.$queryRaw<
      Array<{
        productId: string;
        totalClicks: number;
        uniqueVisitors: number;
        lastClickedAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT
        metadata->>'requestedProductId' AS "productId",
        COUNT(*)::int AS "totalClicks",
        COUNT(
          DISTINCT (
            COALESCE(NULLIF(metadata->>'ip', ''), 'unknown')
            || '|'
            || COALESCE(NULLIF(metadata->>'userAgent', ''), 'unknown')
          )
        )::int AS "uniqueVisitors",
        MAX("created_at") AS "lastClickedAt"
      FROM "audit_logs"
      WHERE "tenant_id" = ${tenantId}
        AND "action" = ${AuditAction.ShareAccess}
        AND "resource_type" = 'public_share'
        AND "created_at" >= ${since}
        AND metadata->>'phase' = 'data'
        AND COALESCE(metadata->>'requestedProductId', '') <> ''
      GROUP BY metadata->>'requestedProductId'
      ORDER BY COUNT(*) DESC, MAX("created_at") DESC
      LIMIT ${query.limit}
    `);

    if (rows.length === 0) {
      return {
        days: query.days,
        items: []
      };
    }

    const productIds = rows.map((row) => row.productId);
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        id: {
          in: productIds
        }
      },
      select: {
        id: true,
        code: true,
        name: true
      }
    });
    const productMap = new Map(products.map((item) => [item.id, item]));
    const items: ProductPublicClicksItem[] = [];

    for (const row of rows) {
      const product = productMap.get(row.productId);
      if (!product) {
        continue;
      }

      items.push({
        productId: row.productId,
        code: product.code,
        name: product.name,
        totalClicks: row.totalClicks,
        uniqueVisitors: row.uniqueVisitors,
        lastClickedAt: row.lastClickedAt ? row.lastClickedAt.toISOString() : null
      });
    }

    return {
      days: query.days,
      items
    };
  }

  async listProductEvents(tenantId: string, productId: string): Promise<ProductEvent[]> {
    await this.findProductOrThrow(tenantId, productId);

    const events = await this.prisma.productEvent.findMany({
      where: {
        tenantId,
        productId
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    });

    return events.map((event) => this.toProductEvent(event));
  }

  async getProductFamilyTree(tenantId: string, productId: string): Promise<ProductFamilyTree> {
    const product = await this.findProductOrThrow(tenantId, productId);
    const currentMateCode = await this.resolveCurrentMateCode(tenantId, product);

    const [sire, dam, mate, children] = await Promise.all([
      this.findProductByCode(tenantId, product.sireCode),
      this.findProductByCode(tenantId, product.damCode),
      this.findProductByCandidates(tenantId, canonicalMateCodeCandidates(currentMateCode)),
      this.prisma.product.findMany({
        where: {
          tenantId,
          OR: [
            {
              sireCode: {
                equals: product.code,
                mode: 'insensitive'
              }
            },
            {
              damCode: {
                equals: product.code,
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
      self: this.toFamilyTreeNode(product),
      sire: this.toFamilyTreeNodeOrNull(sire),
      dam: this.toFamilyTreeNodeOrNull(dam),
      mate: this.toFamilyTreeNodeOrNull(mate),
      children: children.map((child) => this.toFamilyTreeNode(child)),
      links: {
        sire: this.toFamilyTreeLink(product.sireCode, sire),
        dam: this.toFamilyTreeLink(product.damCode, dam),
        mate: this.toFamilyTreeLink(currentMateCode, mate)
      },
      limitations:
        'Product family-tree currently includes self, immediate sire/dam/mate, and direct children only.'
    };
  }

  async listProductImages(tenantId: string, productId: string): Promise<ProductImage[]> {
    await this.findProductOrThrow(tenantId, productId);

    const images = await this.prisma.productImage.findMany({
      where: {
        tenantId,
        productId
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    return images.map((image) => this.toProductImage(image));
  }

  async uploadProductImage(
    tenantId: string,
    actorUserId: string,
    productId: string,
    file: UploadedBinaryFile
  ): Promise<ProductImage> {
    const product = await this.findProductOrThrow(tenantId, productId);
    await this.tenantSubscriptionsService.assertImageUploadAllowed(tenantId, file.buffer.length);

    const nextSortOrder = await this.getNextSortOrder(tenantId, product.id);
    const existingImageCount = await this.prisma.productImage.count({
      where: {
        tenantId,
        productId: product.id
      }
    });

    const extension = this.getFileExtension(file.originalname, file.mimetype);
    const key = `${tenantId}/products/${product.id}/${Date.now()}-${randomUUID()}${extension}`;
    const contentType = file.mimetype?.trim() || 'application/octet-stream';

    let uploadResult: { key: string; url: string } | null = null;

    try {
      uploadResult = await this.storageProvider.putObject({
        key,
        body: file.buffer,
        contentType
      });

      const image = await this.prisma.productImage.create({
        data: {
          tenantId,
          productId: product.id,
          key: uploadResult.key,
          url: uploadResult.url,
          contentType,
          sizeBytes: BigInt(file.buffer.length),
          sortOrder: nextSortOrder,
          isMain: existingImageCount === 0
        }
      });

      await this.auditLogsService.createLog({
        tenantId,
        actorUserId,
        action: AuditAction.ProductImageUpload,
        resourceType: 'product_image',
        resourceId: image.id,
        metadata: {
          productId: product.id,
          sortOrder: image.sortOrder,
          isMain: image.isMain
        }
      });

      return this.toProductImage(image);
    } catch (error) {
      if (uploadResult) {
        await this.storageProvider.deleteObject(uploadResult.key).catch(() => undefined);
      }
      throw error;
    }
  }

  async deleteProductImage(
    tenantId: string,
    actorUserId: string,
    productId: string,
    imageId: string
  ) {
    await this.findProductOrThrow(tenantId, productId);

    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        tenantId,
        productId
      }
    });

    if (!image) {
      throw new NotFoundException({
        message: 'Product image not found.',
        errorCode: ErrorCode.ProductImageNotFound
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({
        where: {
          id: image.id
        }
      });

      if (!image.isMain) {
        return;
      }

      const nextMainImage = await tx.productImage.findFirst({
        where: {
          tenantId,
          productId
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
      });

      if (!nextMainImage) {
        return;
      }

      await tx.productImage.update({
        where: {
          id: nextMainImage.id
        },
        data: {
          isMain: true
        }
      });
    });

    await this.storageProvider.deleteObject(image.key);

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductImageDelete,
      resourceType: 'product_image',
      resourceId: image.id,
      metadata: {
        productId,
        wasMain: image.isMain
      }
    });

    return { deleted: true, imageId: image.id };
  }

  async setMainImage(
    tenantId: string,
    actorUserId: string,
    productId: string,
    imageId: string
  ): Promise<ProductImage> {
    await this.findProductOrThrow(tenantId, productId);

    const targetImage = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        tenantId,
        productId
      }
    });

    if (!targetImage) {
      throw new NotFoundException({
        message: 'Product image not found.',
        errorCode: ErrorCode.ProductImageNotFound
      });
    }

    const previousMainImage = await this.prisma.productImage.findFirst({
      where: {
        tenantId,
        productId,
        isMain: true
      },
      select: {
        id: true
      }
    });

    const updatedImage = await this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: {
          tenantId,
          productId
        },
        data: {
          isMain: false
        }
      });

      return tx.productImage.update({
        where: {
          id: targetImage.id
        },
        data: {
          isMain: true
        }
      });
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductImageSetMain,
      resourceType: 'product_image',
      resourceId: updatedImage.id,
      metadata: {
        productId,
        previousMainImageId: previousMainImage?.id ?? null
      }
    });

    return this.toProductImage(updatedImage);
  }

  async reorderImages(
    tenantId: string,
    actorUserId: string,
    productId: string,
    payload: ReorderProductImagesRequest
  ): Promise<ProductImage[]> {
    await this.findProductOrThrow(tenantId, productId);

    const uniqueIds = new Set(payload.imageIds);
    if (uniqueIds.size !== payload.imageIds.length) {
      throw new BadRequestException('imageIds contains duplicate values.');
    }

    const existingImages = await this.prisma.productImage.findMany({
      where: {
        tenantId,
        productId
      },
      select: {
        id: true
      }
    });

    const existingIdSet = new Set(existingImages.map((image) => image.id));
    if (
      payload.imageIds.length !== existingImages.length ||
      payload.imageIds.some((imageId) => !existingIdSet.has(imageId))
    ) {
      throw new BadRequestException('imageIds must include all images for this product exactly once.');
    }

    await this.prisma.$transaction(
      payload.imageIds.map((imageId, index) =>
        this.prisma.productImage.update({
          where: {
            id: imageId
          },
          data: {
            sortOrder: index
          }
        })
      )
    );

    const images = await this.prisma.productImage.findMany({
      where: {
        tenantId,
        productId
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    await this.auditLogsService.createLog({
      tenantId,
      actorUserId,
      action: AuditAction.ProductImageReorder,
      resourceType: 'product',
      resourceId: productId,
      metadata: {
        imageIds: payload.imageIds
      }
    });

    return images.map((image) => this.toProductImage(image));
  }

  async getProductImageContent(
    tenantId: string,
    productId: string,
    imageId: string
  ): Promise<ProductImageContentResult> {
    await this.findProductOrThrow(tenantId, productId);

    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        tenantId,
        productId
      }
    });

    if (!image) {
      throw new NotFoundException({
        message: 'Product image not found.',
        errorCode: ErrorCode.ProductImageNotFound
      });
    }

    if (!this.isManagedStorageKey(tenantId, image.key)) {
      const redirectUrl = (image.url ?? '').trim();
      // Avoid open redirects or accidental exposure of internal URLs.
      if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
        throw new NotFoundException({
          message: 'Product image not found.',
          errorCode: ErrorCode.ProductImageNotFound
        });
      }

      return {
        redirectUrl,
        contentType: image.contentType
      };
    }

    try {
      const storedObject = await this.storageProvider.getObject(image.key);
      return {
        content: storedObject.body,
        contentType: image.contentType ?? storedObject.contentType
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException({
          message: 'Stored image binary was not found.',
          errorCode: ErrorCode.ProductImageNotFound
        });
      }

      throw error;
    }
  }

  private async findProductByCode(
    tenantId: string,
    code: string | null | undefined
  ): Promise<PrismaProduct | null> {
    const normalizedCode = code?.trim();
    if (!normalizedCode) {
      return null;
    }

    return this.prisma.product.findFirst({
      where: {
        tenantId,
        code: {
          equals: normalizedCode,
          mode: 'insensitive'
        }
      }
    });
  }

  private async findProductByCandidates(tenantId: string, candidates: string[]): Promise<PrismaProduct | null> {
    for (const candidate of candidates) {
      const found = await this.findProductByCode(tenantId, candidate);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private async resolveCurrentMateCode(tenantId: string, product: PrismaProduct): Promise<string | null> {
    const explicitMateCode = this.normalizeOptionalCode(product.mateCode);
    if (explicitMateCode) {
      return explicitMateCode;
    }

    const parsedFromDescription = this.normalizeOptionalCode(parseCurrentMateCode(product.description));
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

    if (!latestMatingEvent) {
      return null;
    }

    const taggedMaleCode = this.normalizeOptionalCode(this.extractTagValue(latestMatingEvent.note, 'maleCode'));
    if (taggedMaleCode) {
      return taggedMaleCode;
    }

    return null;
  }

  private async findProductOrThrow(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId
      }
    });

    if (!product) {
      throw new NotFoundException({
        message: 'Product not found.',
        errorCode: ErrorCode.ProductNotFound
      });
    }

    return product;
  }

  private async getNextSortOrder(tenantId: string, productId: string): Promise<number> {
    const aggregate = await this.prisma.productImage.aggregate({
      where: {
        tenantId,
        productId
      },
      _max: {
        sortOrder: true
      }
    });

    return (aggregate._max.sortOrder ?? -1) + 1;
  }

  private getFileExtension(originalName: string, mimeType: string): string {
    const extensionFromName = path.extname(originalName).trim();
    if (extensionFromName) {
      return extensionFromName.toLowerCase();
    }

    const extensionMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif'
    };

    return extensionMap[mimeType] ?? '';
  }

  private getSinceDate(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private parseEventDate(input: string): Date {
    try {
      return parseEventDateInput(input);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid event_date format');
    }
  }

  private compareProductCode(left: string, right: string, sortDir: Prisma.SortOrder): number {
    const compared = this.naturalCodeCollator.compare(left, right);
    return sortDir === 'desc' ? -compared : compared;
  }

  private buildVisitorKey(ip: string | null, userAgent: string | null) {
    const normalizedIp = ip?.trim() || 'unknown-ip';
    const normalizedUserAgent = userAgent?.trim() || 'unknown-ua';
    return `${normalizedIp}|${normalizedUserAgent}`;
  }

  private isProductCodeConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    return target.includes('tenant_id') && target.includes('code');
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : null;
  }

  private normalizeOptionalCode(value: string | null | undefined): string | null {
    return normalizeCodeUpper(value);
  }

  private normalizeRequiredCode(value: string): string {
    const normalized = this.normalizeOptionalCode(value);
    if (!normalized) {
      throw new BadRequestException('code is required.');
    }

    return normalized;
  }

  private normalizeOptionalSex(value: string | null | undefined): string | null {
    const normalizedValue = this.normalizeOptionalText(value);
    return normalizedValue ? normalizedValue.toLowerCase() : null;
  }

  private assertFemaleProduct(product: PrismaProduct, field: string): void {
    if ((product.sex ?? '').toLowerCase() !== 'female') {
      throw new BadRequestException(`${field} must reference a female breeder.`);
    }
  }

  private assertMaleProduct(product: PrismaProduct, field: string): void {
    if ((product.sex ?? '').toLowerCase() !== 'male') {
      throw new BadRequestException(`${field} must reference a male breeder.`);
    }
  }

  private assertSameSeries(left: PrismaProduct, right: PrismaProduct): void {
    if (!left.seriesId || !right.seriesId || left.seriesId !== right.seriesId) {
      throw new BadRequestException('Mating must be within the same series.');
    }
  }

  private extractTagValue(note: string | null, key: string): string | null {
    if (!note) {
      return null;
    }

    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) {
      return null;
    }

    for (const rawLine of note.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line.startsWith('#') || !line.includes('=')) {
        continue;
      }

      const [rawTag, ...rest] = line.slice(1).split('=');
      if (rawTag.trim().toLowerCase() !== normalizedKey) {
        continue;
      }

      const value = rest.join('=').trim();
      return value.length > 0 ? value : null;
    }

    return null;
  }

  private toProductEvent(event: PrismaProductEvent): ProductEvent {
    return {
      id: event.id,
      tenantId: event.tenantId,
      productId: event.productId,
      eventType: event.eventType,
      eventDate: event.eventDate.toISOString(),
      note: event.note,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString()
    };
  }

  private toFamilyTreeNode(product: PrismaProduct) {
    return {
      id: product.id,
      code: product.code,
      name: product.name,
      sex: product.sex
    };
  }

  private toFamilyTreeLink(
    code: string | null | undefined,
    product: PrismaProduct | null
  ): ProductFamilyTreeLink | null {
    const normalizedCode = code?.trim();
    if (!normalizedCode) {
      return null;
    }

    return {
      code: normalizedCode,
      product: this.toFamilyTreeNodeOrNull(product)
    };
  }

  private toFamilyTreeNodeOrNull(product: PrismaProduct | null) {
    if (!product) {
      return null;
    }

    return this.toFamilyTreeNode(product);
  }

  private toProduct(
    product: PrismaProduct,
    options: {
      coverImageUrl?: string | null;
    } = {}
  ): Product {
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
      sireCode: product.sireCode,
      damCode: product.damCode,
      mateCode: product.mateCode,
      excludeFromBreeding: product.excludeFromBreeding,
      hasSample: product.hasSample,
      inStock: product.inStock,
      popularityScore: product.popularityScore,
      isFeatured: product.isFeatured,
      coverImageUrl: options.coverImageUrl ?? null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    };
  }

  private toProductImage(image: PrismaProductImage): ProductImage {
    return {
      id: image.id,
      tenantId: image.tenantId,
      productId: image.productId,
      key: image.key,
      url: this.buildImageAccessPath(image.productId, image.id),
      contentType: image.contentType,
      sortOrder: image.sortOrder,
      isMain: image.isMain
    };
  }

  private isManagedStorageKey(tenantId: string, key: string): boolean {
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    return normalizedKey.startsWith(`${tenantId}/`);
  }

  private buildImageAccessPath(productId: string, imageId: string): string {
    return `/products/${productId}/images/${imageId}/content`;
  }
}
