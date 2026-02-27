import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';
import type { ListSeriesQuery, Series } from '@eggturtle/shared';
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

    return {
      items: items.map((item) => this.toSeries(item)),
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

  private toSeries(series: PrismaSeries): Series {
    return {
      id: series.id,
      tenantId: series.tenantId,
      code: series.code,
      name: series.name,
      description: series.description,
      sortOrder: series.sortOrder,
      isActive: series.isActive,
      createdAt: series.createdAt.toISOString(),
      updatedAt: series.updatedAt.toISOString()
    };
  }
}
