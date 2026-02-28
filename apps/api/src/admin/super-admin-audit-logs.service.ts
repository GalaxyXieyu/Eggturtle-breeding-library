import { Injectable } from '@nestjs/common';
import {
  SuperAdminAuditAction,
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
    const where: Prisma.SuperAdminAuditLogWhereInput = {
      ...(query.tenantId ? { targetTenantId: query.tenantId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.action
        ? { action: query.action }
        : {
            action: {
              not: SuperAdminAuditAction.ListAuditLogs
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

    const [items, total] = await Promise.all([
      this.prisma.superAdminAuditLog.findMany({
        where,
        include: {
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
        },
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
