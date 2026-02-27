import { Injectable } from '@nestjs/common';
import type { AuditActionType, AuditLog, ListAuditLogsQuery, ListAuditLogsResponse } from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import type { AuditLog as PrismaAuditLog } from '@prisma/client';

import { PrismaService } from '../prisma.service';

type CreateAuditLogInput = {
  tenantId: string;
  actorUserId: string;
  action: AuditActionType;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(input: CreateAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata === undefined ? undefined : (input.metadata ?? Prisma.JsonNull)
      }
    });
  }

  async listLogs(tenantId: string, query: ListAuditLogsQuery): Promise<ListAuditLogsResponse> {
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          tenantId
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: query.pageSize
      }),
      this.prisma.auditLog.count({
        where: {
          tenantId
        }
      })
    ]);

    return {
      logs: items.map((item) => this.toAuditLog(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    };
  }

  private toAuditLog(log: PrismaAuditLog): AuditLog {
    return {
      id: log.id,
      tenantId: log.tenantId,
      actorUserId: log.actorUserId,
      action: log.action as AuditActionType,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString()
    };
  }
}
