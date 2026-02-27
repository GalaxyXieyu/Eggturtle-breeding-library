import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode } from '@eggturtle/shared';
import type {
  Breeder,
  BreederEvent,
  BreederFamilyTree,
  BreederFamilyTreeLink,
  ListBreedersQuery,
  SeriesSummary
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import type { Breeder as PrismaBreeder, BreederEvent as PrismaBreederEvent, Series as PrismaSeries } from '@prisma/client';

import { PrismaService } from '../prisma.service';

type BreederWithSeries = PrismaBreeder & {
  series: PrismaSeries;
};

@Injectable()
export class BreedersService {
  constructor(private readonly prisma: PrismaService) {}

  async listBreeders(tenantId: string, query: ListBreedersQuery) {
    const where = this.buildBreederWhereInput(tenantId, query);
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.breeder.findMany({
        where,
        include: {
          series: true
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: query.pageSize
      }),
      this.prisma.breeder.count({ where })
    ]);

    return {
      items: items.map((item) => this.toBreeder(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    };
  }

  async getBreederByCode(tenantId: string, code: string): Promise<Breeder> {
    const normalizedCode = code.trim();
    const breeder = await this.prisma.breeder.findFirst({
      where: {
        tenantId,
        code: {
          equals: normalizedCode,
          mode: 'insensitive'
        }
      },
      include: {
        series: true
      }
    });

    if (!breeder) {
      throw new NotFoundException({
        message: 'Breeder not found.',
        errorCode: ErrorCode.BreederNotFound
      });
    }

    return this.toBreeder(breeder);
  }

  async getBreederById(tenantId: string, id: string): Promise<Breeder> {
    const breeder = await this.prisma.breeder.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        series: true
      }
    });

    if (!breeder) {
      throw new NotFoundException({
        message: 'Breeder not found.',
        errorCode: ErrorCode.BreederNotFound
      });
    }

    return this.toBreeder(breeder);
  }

  async listBreederEvents(tenantId: string, breederId: string): Promise<BreederEvent[]> {
    await this.assertBreederExists(tenantId, breederId);

    const events = await this.prisma.breederEvent.findMany({
      where: {
        tenantId,
        breederId
      },
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    });

    return events.map((event) => this.toBreederEvent(event));
  }

  async getBreederFamilyTree(tenantId: string, breederId: string): Promise<BreederFamilyTree> {
    const breeder = await this.prisma.breeder.findFirst({
      where: {
        id: breederId,
        tenantId
      }
    });

    if (!breeder) {
      throw new NotFoundException({
        message: 'Breeder not found.',
        errorCode: ErrorCode.BreederNotFound
      });
    }

    const [sire, dam, mate, children] = await Promise.all([
      this.findBreederByCode(tenantId, breeder.sireCode),
      this.findBreederByCode(tenantId, breeder.damCode),
      this.findBreederByCode(tenantId, breeder.mateCode),
      this.prisma.breeder.findMany({
        where: {
          tenantId,
          OR: [
            {
              sireCode: {
                equals: breeder.code,
                mode: 'insensitive'
              }
            },
            {
              damCode: {
                equals: breeder.code,
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
      self: this.toFamilyTreeNode(breeder),
      sire: this.toFamilyTreeNodeOrNull(sire),
      dam: this.toFamilyTreeNodeOrNull(dam),
      mate: this.toFamilyTreeNodeOrNull(mate),
      children: children.map((child) => this.toFamilyTreeNode(child)),
      links: {
        sire: this.toFamilyTreeLink(breeder.sireCode, sire),
        dam: this.toFamilyTreeLink(breeder.damCode, dam),
        mate: this.toFamilyTreeLink(breeder.mateCode, mate)
      },
      limitations:
        'Milestone 1 limitation: returns only self, immediate sire/dam/mate, and direct children. Extended ancestors, siblings, and descendant depth traversal are not included yet.'
    };
  }

  private buildBreederWhereInput(tenantId: string, query: ListBreedersQuery): Prisma.BreederWhereInput {
    const where: Prisma.BreederWhereInput = {
      tenantId
    };

    const andClauses: Prisma.BreederWhereInput[] = [];

    if (query.seriesId) {
      andClauses.push({
        seriesId: query.seriesId
      });
    }

    if (query.code) {
      andClauses.push({
        code: {
          equals: query.code,
          mode: 'insensitive'
        }
      });
    }

    if (query.search) {
      andClauses.push({
        OR: [
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
        ]
      });
    }

    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    return where;
  }

  private async assertBreederExists(tenantId: string, breederId: string): Promise<void> {
    const breeder = await this.prisma.breeder.findFirst({
      where: {
        id: breederId,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!breeder) {
      throw new NotFoundException({
        message: 'Breeder not found.',
        errorCode: ErrorCode.BreederNotFound
      });
    }
  }

  private async findBreederByCode(
    tenantId: string,
    code: string | null | undefined
  ): Promise<PrismaBreeder | null> {
    const normalizedCode = code?.trim();
    if (!normalizedCode) {
      return null;
    }

    return this.prisma.breeder.findFirst({
      where: {
        tenantId,
        code: {
          equals: normalizedCode,
          mode: 'insensitive'
        }
      }
    });
  }

  private toBreeder(breeder: BreederWithSeries): Breeder {
    return {
      id: breeder.id,
      tenantId: breeder.tenantId,
      seriesId: breeder.seriesId,
      code: breeder.code,
      name: breeder.name,
      sex: breeder.sex,
      description: breeder.description,
      sireCode: breeder.sireCode,
      damCode: breeder.damCode,
      mateCode: breeder.mateCode,
      isActive: breeder.isActive,
      createdAt: breeder.createdAt.toISOString(),
      updatedAt: breeder.updatedAt.toISOString(),
      series: this.toSeriesSummary(breeder.series)
    };
  }

  private toSeriesSummary(series: PrismaSeries): SeriesSummary {
    return {
      id: series.id,
      tenantId: series.tenantId,
      code: series.code,
      name: series.name,
      sortOrder: series.sortOrder,
      isActive: series.isActive
    };
  }

  private toBreederEvent(event: PrismaBreederEvent): BreederEvent {
    return {
      id: event.id,
      tenantId: event.tenantId,
      breederId: event.breederId,
      eventType: event.eventType,
      eventDate: event.eventDate.toISOString(),
      note: event.note,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString()
    };
  }

  private toFamilyTreeNode(breeder: PrismaBreeder) {
    return {
      id: breeder.id,
      code: breeder.code,
      name: breeder.name,
      sex: breeder.sex
    };
  }

  private toFamilyTreeLink(
    code: string | null | undefined,
    breeder: PrismaBreeder | null
  ): BreederFamilyTreeLink | null {
    const normalizedCode = code?.trim();
    if (!normalizedCode) {
      return null;
    }

    return {
      code: normalizedCode,
      breeder: this.toFamilyTreeNodeOrNull(breeder)
    };
  }

  private toFamilyTreeNodeOrNull(breeder: PrismaBreeder | null) {
    if (!breeder) {
      return null;
    }

    return this.toFamilyTreeNode(breeder);
  }
}
