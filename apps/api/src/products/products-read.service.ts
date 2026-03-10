import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ErrorCode } from '@eggturtle/shared';
import type {
  ListProductsPublicClicksQuery,
  ListProductsQuery,
  Product,
  ProductFamilyTree,
  ProductFamilyTreeLink,
  ProductListStats,
  ProductMaleMatingHistoryItem,
  ProductPublicClicksItem,
  ProductPublicClicksSummary,
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import type { Product as PrismaProduct } from '@prisma/client';

import { PrismaService } from '../prisma.service';

import { canonicalMateCodeCandidates, normalizeCodeUpper, parseCurrentMateCode } from './breeding-rules';
import {
  calculateDaysSince,
  parseTaggedProductEventNote,
  resolveNeedMatingStatus,
} from './product-event-utils';

@Injectable()
export class ProductsReadService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly naturalCodeCollator = new Intl.Collator('zh-Hans-CN', {
    numeric: true,
    sensitivity: 'base',
  });

  async listProducts(tenantId: string, query: ListProductsQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const exactCode = query.code?.trim();
    const keyword = query.search?.trim();
    const productType = query.type?.trim();
    const sex = query.sex?.trim();
    const seriesId = query.seriesId?.trim();
    const sortDir: Prisma.SortOrder = query.sortDir ?? 'desc';

    const where: Prisma.ProductWhereInput = {
      tenantId,
    };

    if (keyword) {
      where.OR = [
        {
          code: {
            contains: keyword,
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: keyword,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: keyword,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (exactCode) {
      where.code = {
        equals: exactCode,
        mode: 'insensitive',
      };
    }

    if (sex) {
      where.sex = {
        equals: sex,
        mode: 'insensitive',
      };
    }

    if (productType) {
      where.type = {
        equals: productType,
        mode: 'insensitive',
      };
    }

    if (seriesId) {
      where.seriesId = {
        equals: seriesId,
        mode: 'insensitive',
      };
    }

    const include = {
      images: {
        where: {
          isMain: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: 1,
        select: {
          id: true,
        },
      },
    } satisfies Prisma.ProductInclude;

    let items: Array<
      PrismaProduct & {
        images: Array<{ id: string }>;
      }
    > = [];
    let total = 0;

    if (query.sortBy !== 'updatedAt') {
      const all = await this.prisma.product.findMany({
        where,
        include,
      });
      all.sort((left, right) => this.compareProductsDefault(left, right, sortDir));
      total = all.length;
      items = all.slice(skip, skip + query.pageSize);
    } else {
      const [pagedItems, countedTotal] = await Promise.all([
        this.prisma.product.findMany({
          where,
          include,
          orderBy: {
            updatedAt: sortDir,
          },
          skip,
          take: query.pageSize,
        }),
        this.prisma.product.count({
          where,
        }),
      ]);
      items = pagedItems;
      total = countedTotal;
    }

    const needMatingSummaryByProductId = await this.loadNeedMatingSummaryByProductIds(
      tenantId,
      items.map((item) => item.id),
    );
    const stats = await this.loadListStats(tenantId, where);

    return {
      products: items.map((item) =>
        this.toProduct(item, {
          coverImageUrl: item.images[0] ? this.buildImageAccessPath(item.id, item.images[0].id) : null,
          needMatingSummary: needMatingSummaryByProductId.get(item.id),
        }),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      stats,
    };
  }

  async getProductByCode(tenantId: string, code: string): Promise<Product> {
    const normalizedCode = code.trim();
    const product = await this.prisma.product.findFirst({
      where: {
        tenantId,
        code: {
          equals: normalizedCode,
          mode: 'insensitive',
        },
      },
      include: {
        images: {
          where: {
            isMain: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 1,
          select: {
            id: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException({
        message: 'Product not found.',
        errorCode: ErrorCode.ProductNotFound,
      });
    }

    return this.toProduct(product, {
      coverImageUrl: product.images[0] ? this.buildImageAccessPath(product.id, product.images[0].id) : null,
    });
  }

  async getProductById(tenantId: string, productId: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId,
      },
      include: {
        images: {
          where: {
            isMain: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 1,
          select: {
            id: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException({
        message: 'Product not found.',
        errorCode: ErrorCode.ProductNotFound,
      });
    }

    return this.toProduct(product, {
      coverImageUrl: product.images[0] ? this.buildImageAccessPath(product.id, product.images[0].id) : null,
    });
  }

  async getProductPublicClicks(
    tenantId: string,
    productId: string,
    days: number,
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
      lastClickedAt: rows[0]?.createdAt ? rows[0].createdAt.toISOString() : null,
    };
  }

  async listProductPublicClicks(
    tenantId: string,
    query: ListProductsPublicClicksQuery,
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
        items: [],
      };
    }

    const productIds = rows.map((row) => row.productId);
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
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
        lastClickedAt: row.lastClickedAt ? row.lastClickedAt.toISOString() : null,
      });
    }

    return {
      days: query.days,
      items,
    };
  }

  async getProductFamilyTree(tenantId: string, productId: string): Promise<ProductFamilyTree> {
    const product = await this.findProductOrThrow(tenantId, productId);
    const currentMateCode = await this.resolveCurrentMateCode(tenantId, product);
    const isMale = product.sex?.trim().toLowerCase() === 'male';
    const mateCodeCandidates = canonicalMateCodeCandidates(isMale ? product.code : currentMateCode);

    const [sire, dam, mate, children, relatedFemales] = await Promise.all([
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
                mode: 'insensitive',
              },
            },
            {
              damCode: {
                equals: product.code,
                mode: 'insensitive',
              },
            },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
      this.listMatchedFemaleProductsForMale(tenantId, product, mateCodeCandidates),
    ]);

    const needMatingSummaryByProductId = await this.loadNeedMatingSummaryByProductIds(
      tenantId,
      relatedFemales.map((item) => item.id),
    );

    const sortedRelatedFemales = relatedFemales.slice().sort((a, b) => {
      const aSummary = needMatingSummaryByProductId.get(a.id);
      const bSummary = needMatingSummaryByProductId.get(b.id);
      const rank = (status?: 'normal' | 'need_mating' | 'warning') =>
        status === 'warning' ? 2 : status === 'need_mating' ? 1 : 0;
      const bySeverity = rank(bSummary?.status) - rank(aSummary?.status);
      if (bySeverity !== 0) {
        return bySeverity;
      }

      const byDays = (bSummary?.daysSinceEgg ?? -1) - (aSummary?.daysSinceEgg ?? -1);
      if (byDays !== 0) {
        return byDays;
      }

      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    const coverImageUrlByProductId = await this.loadFamilyTreeCoverImageUrls(
      [product, sire, dam, mate, ...children, ...sortedRelatedFemales]
        .filter((item): item is PrismaProduct => Boolean(item))
        .map((item) => item.id),
    );

    return {
      self: this.toFamilyTreeNode(product, coverImageUrlByProductId),
      sire: this.toFamilyTreeNodeOrNull(sire, coverImageUrlByProductId),
      dam: this.toFamilyTreeNodeOrNull(dam, coverImageUrlByProductId),
      mate: this.toFamilyTreeNodeOrNull(mate, coverImageUrlByProductId),
      mates: sortedRelatedFemales.map((female) => {
        const summary = needMatingSummaryByProductId.get(female.id);
        return {
          ...this.toFamilyTreeNode(female, coverImageUrlByProductId),
          needMatingStatus: summary?.status ?? null,
          lastEggAt: summary?.lastEggAt?.toISOString() ?? null,
          lastMatingAt: summary?.lastMatingAt?.toISOString() ?? null,
          daysSinceEgg: summary?.daysSinceEgg ?? null,
        };
      }),
      children: children.map((child) => this.toFamilyTreeNode(child, coverImageUrlByProductId)),
      links: {
        sire: this.toFamilyTreeLink(product.sireCode, sire, coverImageUrlByProductId),
        dam: this.toFamilyTreeLink(product.damCode, dam, coverImageUrlByProductId),
        mate: this.toFamilyTreeLink(currentMateCode, mate, coverImageUrlByProductId),
      },
      limitations: isMale
        ? '当前家族谱系按竖向展示自己、直属父母、关联母龟与直系子代；关联母龟按待交配优先级与天数排序。'
        : '当前家族谱系仅展示自己、直属父母、当前配偶与直系子代。',
    };
  }

  async listProductMaleMatingHistory(
    tenantId: string,
    productId: string,
  ): Promise<ProductMaleMatingHistoryItem[]> {
    const product = await this.findProductOrThrow(tenantId, productId);
    const isMale = product.sex?.trim().toLowerCase() === 'male';
    if (!isMale) {
      return [];
    }

    const maleCodeCandidates = canonicalMateCodeCandidates(product.code);
    const matchedFemales = await this.listMatchedFemaleProductsForMale(
      tenantId,
      product,
      maleCodeCandidates,
    );
    if (matchedFemales.length === 0) {
      return [];
    }

    const femaleById = new Map(matchedFemales.map((female) => [female.id, female]));
    const events = await this.prisma.productEvent.findMany({
      where: {
        tenantId,
        productId: {
          in: matchedFemales.map((female) => female.id),
        },
        eventType: 'mating',
        OR: maleCodeCandidates.map((candidate) => ({
          note: {
            contains: `#maleCode=${candidate}`,
            mode: 'insensitive',
          },
        })),
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });

    return events.flatMap((event) => {
      const female = femaleById.get(event.productId);
      if (!female) {
        return [];
      }

      const parsedNote = parseTaggedProductEventNote(event.note);
      const maleCode = this.normalizeOptionalCode(parsedNote.maleCode);
      if (!maleCode || !maleCodeCandidates.includes(maleCode)) {
        return [];
      }

      return [
        {
          id: event.id,
          tenantId: event.tenantId,
          maleProductId: product.id,
          maleCode,
          femaleProductId: female.id,
          femaleCode: female.code,
          femaleName: female.name,
          eventDate: event.eventDate.toISOString(),
          note: parsedNote.note,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.updatedAt.toISOString(),
        },
      ];
    });
  }

  private async loadListStats(
    tenantId: string,
    where: Prisma.ProductWhereInput,
  ): Promise<ProductListStats> {
    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        sex: true,
      },
    });

    if (products.length === 0) {
      return {
        maleCount: 0,
        femaleCount: 0,
        unknownCount: 0,
        yearEggCount: 0,
        needMatingCount: 0,
        warningCount: 0,
      };
    }

    let maleCount = 0;
    let femaleCount = 0;
    let unknownCount = 0;
    const productIds: string[] = [];
    const femaleProductIds: string[] = [];

    for (const product of products) {
      productIds.push(product.id);
      const normalizedSex = product.sex?.trim().toLowerCase() ?? '';
      if (normalizedSex === 'male') {
        maleCount += 1;
      } else if (normalizedSex === 'female') {
        femaleCount += 1;
        femaleProductIds.push(product.id);
      } else {
        unknownCount += 1;
      }
    }

    const [{ needMatingCount, warningCount }, yearEggCount] = await Promise.all([
      this.loadNeedMatingCounters(tenantId, femaleProductIds),
      this.loadCurrentYearEggCount(tenantId, productIds),
    ]);

    return {
      maleCount,
      femaleCount,
      unknownCount,
      yearEggCount,
      needMatingCount,
      warningCount,
    };
  }

  private async loadNeedMatingCounters(
    tenantId: string,
    femaleProductIds: string[],
  ): Promise<{
    needMatingCount: number;
    warningCount: number;
  }> {
    if (femaleProductIds.length === 0) {
      return {
        needMatingCount: 0,
        warningCount: 0,
      };
    }

    const summaryByProductId = await this.loadNeedMatingSummaryByProductIds(
      tenantId,
      femaleProductIds,
    );
    let needMatingCount = 0;
    let warningCount = 0;

    for (const summary of summaryByProductId.values()) {
      if (summary.status === 'need_mating') {
        needMatingCount += 1;
      } else if (summary.status === 'warning') {
        warningCount += 1;
      }
    }

    return {
      needMatingCount,
      warningCount,
    };
  }

  private async loadCurrentYearEggCount(tenantId: string, productIds: string[]): Promise<number> {
    if (productIds.length === 0) {
      return 0;
    }

    const currentYear = new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(currentYear + 1, 0, 1, 0, 0, 0, 0));

    const events = await this.prisma.productEvent.findMany({
      where: {
        tenantId,
        productId: {
          in: productIds,
        },
        eventType: 'egg',
        eventDate: {
          gte: yearStart,
          lt: yearEnd,
        },
      },
      select: {
        note: true,
      },
    });

    let yearEggCount = 0;
    for (const event of events) {
      const parsedEggCount = parseTaggedProductEventNote(event.note).eggCount ?? 0;
      yearEggCount += parsedEggCount;
    }

    return yearEggCount;
  }

  private async findProductByCode(
    tenantId: string,
    code: string | null | undefined,
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
          mode: 'insensitive',
        },
      },
    });
  }

  private async findProductByCandidates(
    tenantId: string,
    candidates: string[],
  ): Promise<PrismaProduct | null> {
    for (const candidate of candidates) {
      const found = await this.findProductByCode(tenantId, candidate);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private async listMatchedFemaleProductsForMale(
    tenantId: string,
    product: PrismaProduct,
    mateCodeCandidates = canonicalMateCodeCandidates(product.code),
  ): Promise<PrismaProduct[]> {
    if (product.sex?.trim().toLowerCase() !== 'male' || mateCodeCandidates.length === 0) {
      return [];
    }

    return this.prisma.product.findMany({
      where: {
        tenantId,
        inStock: true,
        sex: {
          equals: 'female',
          mode: 'insensitive',
        },
        OR: mateCodeCandidates.map((candidate) => ({
          mateCode: {
            equals: candidate,
            mode: 'insensitive',
          },
        })),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
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
        eventType: 'mating',
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
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
        tenantId,
      },
    });

    if (!product) {
      throw new NotFoundException({
        message: 'Product not found.',
        errorCode: ErrorCode.ProductNotFound,
      });
    }

    return product;
  }

  private getSinceDate(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private compareProductCode(left: string, right: string, sortDir: Prisma.SortOrder): number {
    const compared = this.naturalCodeCollator.compare(left, right);
    return sortDir === 'desc' ? -compared : compared;
  }

  private compareProductsDefault(
    left: PrismaProduct,
    right: PrismaProduct,
    sortDir: Prisma.SortOrder,
  ): number {
    const leftPinned = this.isPinnedNewUploadCode(left.code);
    const rightPinned = this.isPinnedNewUploadCode(right.code);

    if (leftPinned && !rightPinned) {
      return -1;
    }
    if (!leftPinned && rightPinned) {
      return 1;
    }

    const leftOrder = this.parseProductOrder(left.code);
    const rightOrder = this.parseProductOrder(right.code);

    const leftSexRank = this.getSexRank(left.sex);
    const rightSexRank = this.getSexRank(right.sex);
    if (leftSexRank !== rightSexRank) {
      return leftSexRank - rightSexRank;
    }

    if (leftOrder === null && rightOrder === null) {
      return this.compareProductCode(left.code, right.code, sortDir);
    }

    if (leftOrder === null && rightOrder !== null) {
      return 1;
    }
    if (leftOrder !== null && rightOrder === null) {
      return -1;
    }

    const factor = sortDir === 'asc' ? 1 : -1;
    const leftOrderValue = leftOrder ?? 0;
    const rightOrderValue = rightOrder ?? 0;

    if (leftOrderValue !== rightOrderValue) {
      return (leftOrderValue - rightOrderValue) * factor;
    }

    return this.compareProductCode(left.code, right.code, sortDir);
  }

  private parseProductOrder(code: string): number | null {
    const trimmed = (code ?? '').trim();
    if (!trimmed) {
      return null;
    }

    const match = trimmed.match(/\d+/);
    if (!match) {
      return null;
    }

    const value = Number(match[0]);
    if (!Number.isFinite(value) || value < 1 || value > 100) {
      return null;
    }

    return value;
  }

  private isPinnedNewUploadCode(code: string | null): boolean {
    const trimmed = (code ?? '').trim();
    if (!trimmed) {
      return false;
    }

    return /[\u4e00-\u9fff]/.test(trimmed);
  }

  private getSexRank(value: string | null): number {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'female') {
      return 0;
    }
    if (normalized === 'male') {
      return 1;
    }
    return 2;
  }

  private buildVisitorKey(ip: string | null, userAgent: string | null) {
    const normalizedIp = ip?.trim() || 'unknown-ip';
    const normalizedUserAgent = userAgent?.trim() || 'unknown-ua';
    return `${normalizedIp}|${normalizedUserAgent}`;
  }

  private normalizeOptionalCode(value: string | null | undefined): string | null {
    return normalizeCodeUpper(value);
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

  private async loadFamilyTreeCoverImageUrls(productIds: string[]) {
    const dedupedProductIds = Array.from(new Set(productIds));
    const coverImageUrlByProductId = new Map<string, string | null>();

    for (const productId of dedupedProductIds) {
      coverImageUrlByProductId.set(productId, null);
    }

    if (dedupedProductIds.length === 0) {
      return coverImageUrlByProductId;
    }

    const images = await this.prisma.productImage.findMany({
      where: {
        productId: {
          in: dedupedProductIds,
        },
        isMain: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        productId: true,
      },
    });

    for (const image of images) {
      if ((coverImageUrlByProductId.get(image.productId) ?? null) !== null) {
        continue;
      }

      coverImageUrlByProductId.set(
        image.productId,
        this.buildImageAccessPath(image.productId, image.id),
      );
    }

    return coverImageUrlByProductId;
  }

  private toFamilyTreeNode(
    product: PrismaProduct,
    coverImageUrlByProductId?: Map<string, string | null>,
  ) {
    const coverImageUrl = coverImageUrlByProductId?.get(product.id) ?? null;

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      sex: product.sex,
      publicUrl: coverImageUrl,
      thumbnailUrl: coverImageUrl,
      coverImageUrl,
    };
  }

  private toFamilyTreeLink(
    code: string | null | undefined,
    product: PrismaProduct | null,
    coverImageUrlByProductId?: Map<string, string | null>,
  ): ProductFamilyTreeLink | null {
    const normalizedCode = code?.trim();
    if (!normalizedCode) {
      return null;
    }

    return {
      code: normalizedCode,
      product: this.toFamilyTreeNodeOrNull(product, coverImageUrlByProductId),
    };
  }

  private toFamilyTreeNodeOrNull(
    product: PrismaProduct | null,
    coverImageUrlByProductId?: Map<string, string | null>,
  ) {
    if (!product) {
      return null;
    }

    return this.toFamilyTreeNode(product, coverImageUrlByProductId);
  }

  private toProduct(
    product: PrismaProduct,
    options: {
      coverImageUrl?: string | null;
      needMatingSummary?: {
        status: 'normal' | 'need_mating' | 'warning';
        lastEggAt: Date | null;
        lastMatingAt: Date | null;
        daysSinceEgg: number | null;
      };
    } = {},
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
      needMatingStatus: options.needMatingSummary?.status ?? null,
      lastEggAt: options.needMatingSummary?.lastEggAt?.toISOString() ?? null,
      lastMatingAt: options.needMatingSummary?.lastMatingAt?.toISOString() ?? null,
      daysSinceEgg: options.needMatingSummary?.daysSinceEgg ?? null,
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
      updatedAt: product.updatedAt.toISOString(),
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
        daysSinceEgg: calculateDaysSince(row.lastEggAt),
      });
    }

    return summaryByProductId;
  }

  private buildImageAccessPath(productId: string, imageId: string): string {
    return `/products/${productId}/images/${imageId}/content`;
  }
}
