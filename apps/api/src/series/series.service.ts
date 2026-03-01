import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';
import type { ListSeriesQuery, Series, UpdateSeriesRequest } from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import type { Series as PrismaSeries } from '@prisma/client';

import { PrismaService } from '../prisma.service';

@Injectable()
export class SeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listSeries(tenantId: string, query: ListSeriesQuery) {
    const where: Prisma.SeriesWhereInput = {
      tenantId
    };

    if (query.search) {
      where.OR = [
        {
          code: {
            contains: query.search,
            mode: 'insensitive'
          }
        },
        {
          name: {
            contains: query.search,
            mode: 'insensitive'
          }
        }
      ];
    }

    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.series.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: query.pageSize
      }),
      this.prisma.series.count({ where })
    ]);

    const coverImageUrlsBySeriesId = await this.getCoverImageUrlsBySeriesId(
      tenantId,
      items.map((item) => item.id)
    );

    return {
      items: items.map((item) =>
        this.toSeries(item, {
          coverImageUrl: coverImageUrlsBySeriesId.get(item.id) ?? null
        })
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    };
  }

  async getSeriesById(tenantId: string, id: string): Promise<Series> {
    const series = await this.prisma.series.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!series) {
      throw new NotFoundException({
        message: 'Series not found.',
        errorCode: ErrorCode.SeriesNotFound
      });
    }

    return this.toSeries(series);
  }

  async updateSeries(tenantId: string, id: string, payload: UpdateSeriesRequest): Promise<Series> {
    const existing = await this.prisma.series.findFirst({
      where: {
        id,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Series not found.',
        errorCode: ErrorCode.SeriesNotFound
      });
    }

    const updateData: Prisma.SeriesUpdateInput = {
      updatedAt: new Date()
    };

    if (payload.name !== undefined) {
      updateData.name = payload.name;
    }

    if (payload.description !== undefined) {
      updateData.description = this.normalizeNullableText(payload.description);
    }

    if (payload.isActive !== undefined) {
      updateData.isActive = payload.isActive;
    }

    if (payload.sortOrder !== undefined) {
      updateData.sortOrder = payload.sortOrder;
    }

    const series = await this.prisma.series.update({
      where: {
        id
      },
      data: updateData
    });

    return this.toSeries(series);
  }

  private async getCoverImageUrlsBySeriesId(tenantId: string, seriesIds: string[]): Promise<Map<string, string | null>> {
    const uniqueSeriesIds = Array.from(new Set(seriesIds.filter((seriesId) => seriesId.length > 0)));
    const coverImageUrlsBySeriesId = new Map<string, string | null>();

    for (const seriesId of uniqueSeriesIds) {
      coverImageUrlsBySeriesId.set(seriesId, null);
    }

    if (uniqueSeriesIds.length === 0) {
      return coverImageUrlsBySeriesId;
    }

    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        inStock: true,
        seriesId: {
          in: uniqueSeriesIds
        },
        images: {
          some: {
            isMain: true
          }
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
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

    for (const product of products) {
      if (!product.seriesId) {
        continue;
      }

      if ((coverImageUrlsBySeriesId.get(product.seriesId) ?? null) !== null) {
        continue;
      }

      const coverImage = product.images[0];
      if (!coverImage) {
        continue;
      }

      coverImageUrlsBySeriesId.set(product.seriesId, this.buildImageAccessPath(product.id, coverImage.id));
    }

    return coverImageUrlsBySeriesId;
  }

  private toSeries(series: PrismaSeries, options: { coverImageUrl?: string | null } = {}): Series {
    return {
      id: series.id,
      tenantId: series.tenantId,
      code: series.code,
      name: series.name,
      description: series.description,
      sortOrder: series.sortOrder,
      isActive: series.isActive,
      coverImageUrl: options.coverImageUrl ?? null,
      createdAt: series.createdAt.toISOString(),
      updatedAt: series.updatedAt.toISOString()
    };
  }

  private normalizeNullableText(value: string | null): string | null {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private buildImageAccessPath(productId: string, imageId: string): string {
    return `/products/${productId}/images/${imageId}/content`;
  }
}
