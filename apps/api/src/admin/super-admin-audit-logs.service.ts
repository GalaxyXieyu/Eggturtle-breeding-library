import { Injectable } from '@nestjs/common';
import {
  SuperAdminAuditAction,
  type ExportSuperAdminAuditLogsQuery,
  type ListSuperAdminAuditLogsQuery,
  type ListSuperAdminAuditLogsResponse,
  type SuperAdminAuditActionType,
  type SuperAdminAuditLog
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import type { SuperAdminAuditLog as PrismaSuperAdminAuditLog } from '@prisma/client';

import { PrismaService } from '../prisma.service';

type CreateSuperAdminAuditLogInput = {
  actorUserId: string;
  targetTenantId?: string | null;
  action: SuperAdminAuditActionType;
  metadata?: Prisma.InputJsonValue | null;
};

type SuperAdminAuditLogWithRelations = PrismaSuperAdminAuditLog & {
  actorUser: {
    email: string;
  };
  targetTenant: {
    slug: string;
  } | null;
};

type ExportLogsResult = {
  logs: SuperAdminAuditLog[];
  truncated: boolean;
};

@Injectable()
export class SuperAdminAuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(input: CreateSuperAdminAuditLogInput, db?: Prisma.TransactionClient): Promise<string> {
    const client = db ?? this.prisma;

    const created = await client.superAdminAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        targetTenantId: input.targetTenantId ?? null,
        action: input.action,
        metadata: input.metadata === undefined ? undefined : (input.metadata ?? Prisma.JsonNull)
      }
    });

    return created.id;
  }

  async listLogs(query: ListSuperAdminAuditLogsQuery): Promise<ListSuperAdminAuditLogsResponse> {
    const skip = (query.page - 1) * query.pageSize;
    const where = this.buildWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.superAdminAuditLog.findMany({
        where,
        include: this.defaultInclude,
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: query.pageSize
      }),
      this.prisma.superAdminAuditLog.count({ where })
    ]);

    return {
      logs: items.map((item) => this.toAuditLog(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    };
  }

  async listLogsForExport(query: ExportSuperAdminAuditLogsQuery): Promise<ExportLogsResult> {
    const where = this.buildWhere(query);
    const items = await this.prisma.superAdminAuditLog.findMany({
      where,
      include: this.defaultInclude,
      orderBy: {
        createdAt: 'desc'
      },
      take: query.limit + 1
    });

    const truncated = items.length > query.limit;
    const logs = (truncated ? items.slice(0, query.limit) : items).map((item) => this.toAuditLog(item));

    return {
      logs,
      truncated
    };
  }

  private buildWhere(query: {
    tenantId?: string;
    actorUserId?: string;
    action?: SuperAdminAuditActionType;
    from?: string;
    to?: string;
  }): Prisma.SuperAdminAuditLogWhereInput {
    return {
      ...(query.tenantId ? { targetTenantId: query.tenantId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.action
        ? { action: query.action }
        : {
            action: {
              notIn: [SuperAdminAuditAction.ListAuditLogs, SuperAdminAuditAction.ExportAuditLogs]
            }
          }),
      ...((query.from || query.to)
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {})
            }
          }
        : {})
    };
  }

  private readonly defaultInclude = {
    actorUser: {
      select: {
        email: true
      }
    },
    targetTenant: {
      select: {
        slug: true
      }
    }
  } satisfies Prisma.SuperAdminAuditLogInclude;

  private toAuditLog(log: SuperAdminAuditLogWithRelations): SuperAdminAuditLog {
    return {
      id: log.id,
      actorUserId: log.actorUserId,
      actorUserEmail: log.actorUser?.email ?? null,
      targetTenantId: log.targetTenantId,
      targetTenantSlug: log.targetTenant?.slug ?? null,
      action: log.action as SuperAdminAuditActionType,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString()
    };
  }
}
