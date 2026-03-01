import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';
import type {
  CreateFeaturedProductRequest,
  FeaturedProductItem,
  Product,
  ReorderFeaturedProductsRequest
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import type { FeaturedProduct as PrismaFeaturedProduct, Product as PrismaProduct } from '@prisma/client';

import { PrismaService } from '../prisma.service';

type FeaturedWithProduct = PrismaFeaturedProduct & {
  product: PrismaProduct;
};

@Injectable()
export class FeaturedProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listFeaturedProducts(tenantId: string): Promise<FeaturedProductItem[]> {
    const items = await this.prisma.featuredProduct.findMany({
      where: {
        tenantId
      },
      include: {
        product: true
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    return items.map((item) => this.toFeaturedProductItem(item));
  }

  async createFeaturedProduct(
    tenantId: string,
    payload: CreateFeaturedProductRequest
  ): Promise<FeaturedProductItem> {
    await this.findProductOrThrow(tenantId, payload.productId);

    try {
      const item = await this.prisma.$transaction(async (tx) => {
        const targetSortOrder = payload.sortOrder ?? (await this.getNextSortOrder(tx, tenantId));

        if (payload.sortOrder !== undefined) {
          await tx.featuredProduct.updateMany({
            where: {
              tenantId,
              sortOrder: {
                gte: targetSortOrder
              }
            },
            data: {
              sortOrder: {
                increment: 1
              }
            }
          });
        }

        return tx.featuredProduct.create({
          data: {
            tenantId,
            productId: payload.productId,
            sortOrder: targetSortOrder
          },
          include: {
            product: true
          }
        });
      });

      return this.toFeaturedProductItem(item);
    } catch (error) {
      if (this.isDuplicateFeaturedError(error)) {
        throw new ConflictException({
          message: 'Product is already featured in this tenant.',
          errorCode: ErrorCode.FeaturedProductConflict
        });
      }

      throw error;
    }
  }

  async deleteFeaturedProduct(tenantId: string, id: string) {
    const target = await this.prisma.featuredProduct.findFirst({
      where: {
        id,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!target) {
      throw new NotFoundException({
        message: 'Featured product not found.',
        errorCode: ErrorCode.FeaturedProductNotFound
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.featuredProduct.delete({
        where: {
          id: target.id
        }
      });

      await this.compactSortOrder(tx, tenantId);
    });

    return {
      deleted: true as const,
      id: target.id
    };
  }

  async reorderFeaturedProducts(
    tenantId: string,
    payload: ReorderFeaturedProductsRequest
  ): Promise<FeaturedProductItem[]> {
    const existingItems = await this.prisma.featuredProduct.findMany({
      where: {
        tenantId
      },
      select: {
        id: true,
        productId: true
      }
    });

    if (existingItems.length === 0) {
      return [];
    }

    const orderedIds = this.resolveOrderedIds(existingItems, payload);

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.featuredProduct.update({
          where: {
            id
          },
          data: {
            sortOrder: index
          }
        })
      )
    );

    return this.listFeaturedProducts(tenantId);
  }

  async resolveTenantId(query: { tenantId?: string; tenantSlug?: string }): Promise<string | null> {
    if (query.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: {
          id: query.tenantId
        },
        select: {
          id: true
        }
      });

      return tenant?.id ?? null;
    }

    if (!query.tenantSlug) {
      return null;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: {
        slug: query.tenantSlug
      },
      select: {
        id: true
      }
    });

    return tenant?.id ?? null;
  }

  async listPublicFeaturedProducts(tenantId: string, limit: number): Promise<Product[]> {
    const featuredItems = await this.prisma.featuredProduct.findMany({
      where: {
        tenantId
      },
      include: {
        product: true
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: limit
    });

    if (featuredItems.length > 0) {
      return featuredItems.map((item) => this.toProduct(item.product));
    }

    const latestProducts = await this.prisma.product.findMany({
      where: {
        tenantId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    return latestProducts.map((product) => this.toProduct(product));
  }

  private async findProductOrThrow(tenantId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
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
  }

  private async getNextSortOrder(tx: Prisma.TransactionClient, tenantId: string): Promise<number> {
    const aggregate = await tx.featuredProduct.aggregate({
      where: {
        tenantId
      },
      _max: {
        sortOrder: true
      }
    });

    return (aggregate._max.sortOrder ?? -1) + 1;
  }

  private resolveOrderedIds(
    existingItems: Array<{ id: string; productId: string }>,
    payload: ReorderFeaturedProductsRequest
  ): string[] {
    if (payload.ids) {
      return this.validateOrderedIds(existingItems, payload.ids);
    }

    const productIdOrder = payload.productIds;
    if (!productIdOrder) {
      throw new BadRequestException('ids or productIds is required.');
    }

    this.ensureNoDuplicates(productIdOrder, 'productIds contains duplicate values.');

    if (productIdOrder.length !== existingItems.length) {
      throw new BadRequestException(
        'productIds must include all featured products for this tenant exactly once.'
      );
    }

    const idByProductId = new Map(existingItems.map((item) => [item.productId, item.id]));
    const orderedIds = productIdOrder.map((productId) => idByProductId.get(productId));

    if (orderedIds.some((id) => !id)) {
      throw new BadRequestException(
        'productIds must include all featured products for this tenant exactly once.'
      );
    }

    return orderedIds as string[];
  }

  private validateOrderedIds(existingItems: Array<{ id: string }>, ids: string[]): string[] {
    this.ensureNoDuplicates(ids, 'ids contains duplicate values.');

    const existingIdSet = new Set(existingItems.map((item) => item.id));

    if (ids.length !== existingItems.length || ids.some((id) => !existingIdSet.has(id))) {
      throw new BadRequestException('ids must include all featured products for this tenant exactly once.');
    }

    return ids;
  }

  private ensureNoDuplicates(values: string[], message: string): void {
    if (new Set(values).size !== values.length) {
      throw new BadRequestException(message);
    }
  }

  private async compactSortOrder(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
    const items = await tx.featuredProduct.findMany({
      where: {
        tenantId
      },
      select: {
        id: true
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    });

    await Promise.all(
      items.map((item, index) =>
        tx.featuredProduct.update({
          where: {
            id: item.id
          },
          data: {
            sortOrder: index
          }
        })
      )
    );
  }

  private isDuplicateFeaturedError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];

    // Prisma reports P2002 targets as model field names (e.g. tenantId/productId).
    const normalized = new Set(target.map((value) => String(value)));

    const candidates: Array<[string, string]> = [
      ['tenantId', 'productId'],
      ['tenant_id', 'product_id']
    ];

    return candidates.some(([tenantField, productField]) =>
      normalized.has(tenantField) && normalized.has(productField)
    );
  }

  private toFeaturedProductItem(item: FeaturedWithProduct): FeaturedProductItem {
    return {
      id: item.id,
      tenantId: item.tenantId,
      productId: item.productId,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
      product: this.toProduct(item.product)
    };
  }

  private toProduct(product: PrismaProduct): Product {
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
      isFeatured: product.isFeatured
    };
  }
}
