import { Injectable } from '@nestjs/common';
import {
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

@Injectable()
export class SuperAdminAuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(input: CreateSuperAdminAuditLogInput, db?: Prisma.TransactionClient): Promise<void> {
    const client = db ?? this.prisma;

    await client.superAdminAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        targetTenantId: input.targetTenantId ?? null,
        action: input.action,
        metadata: input.metadata === undefined ? undefined : (input.metadata ?? Prisma.JsonNull)
      }
    });
  }

  async listLogs(query: ListSuperAdminAuditLogsQuery): Promise<ListSuperAdminAuditLogsResponse> {
    const skip = (query.page - 1) * query.pageSize;
    const where = {
      ...(query.tenantId ? { targetTenantId: query.tenantId } : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.superAdminAuditLog.findMany({
        where,
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

  private toAuditLog(log: PrismaSuperAdminAuditLog): SuperAdminAuditLog {
    return {
      id: log.id,
      actorUserId: log.actorUserId,
      targetTenantId: log.targetTenantId,
      action: log.action as SuperAdminAuditActionType,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString()
    };
  }
}
