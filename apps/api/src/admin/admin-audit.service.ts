import { BadRequestException, Injectable } from '@nestjs/common';
import { ErrorCode, SuperAdminAuditAction } from '@eggturtle/shared';
import type {
  ExportSuperAdminAuditLogsQuery,
  ListSuperAdminAuditLogsQuery,
  ListSuperAdminAuditLogsResponse
} from '@eggturtle/shared';

import { SuperAdminAuditLogsService } from './super-admin-audit-logs.service';

const AUDIT_EXPORT_MAX_RANGE_DAYS = 31;
const AUDIT_EXPORT_MAX_RANGE_MS = AUDIT_EXPORT_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminAuditService {
  constructor(private readonly superAdminAuditLogsService: SuperAdminAuditLogsService) {}

  async listAuditLogs(
    actorUserId: string,
    query: ListSuperAdminAuditLogsQuery
  ): Promise<ListSuperAdminAuditLogsResponse> {
    const response = await this.superAdminAuditLogsService.listLogs(query);

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      targetTenantId: query.tenantId ?? null,
      action: SuperAdminAuditAction.ListAuditLogs,
      metadata: {
        tenantFilter: query.tenantId ?? null,
        actorUserId: query.actorUserId ?? null,
        action: query.action ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        page: query.page,
        pageSize: query.pageSize,
        resultCount: response.logs.length
      }
    });

    return response;
  }

  async exportAuditLogs(actorUserId: string, query: ExportSuperAdminAuditLogsQuery) {
    const range = this.getAuditExportRangeOrThrow(query);
    const response = await this.superAdminAuditLogsService.listLogsForExport(query);

    if (response.truncated) {
      throw new BadRequestException({
        message: `Export matches more than ${query.limit} rows. Narrow the time range or add more filters and retry.`,
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const csv = this.toAuditLogsCsv(response.logs);

    await this.superAdminAuditLogsService.createLog({
      actorUserId,
      targetTenantId: query.tenantId ?? null,
      action: SuperAdminAuditAction.ExportAuditLogs,
      metadata: {
        tenantFilter: query.tenantId ?? null,
        actorUserId: query.actorUserId ?? null,
        action: query.action ?? null,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        limit: query.limit,
        resultCount: response.logs.length,
        truncated: false
      }
    });

    return {
      csv,
      rowCount: response.logs.length,
      truncated: false
    };
  }

  private getAuditExportRangeOrThrow(query: ExportSuperAdminAuditLogsQuery): { from: Date; to: Date } {
    if (!query.from || !query.to) {
      throw new BadRequestException({
        message: 'Audit export requires both `from` and `to` parameters.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    const from = new Date(query.from);
    const to = new Date(query.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException({
        message: 'Audit export `from` and `to` must be valid ISO datetime strings.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    if (to.getTime() < from.getTime()) {
      throw new BadRequestException({
        message: 'Audit export `to` must be greater than or equal to `from`.',
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    if (to.getTime() - from.getTime() > AUDIT_EXPORT_MAX_RANGE_MS) {
      throw new BadRequestException({
        message: `Audit export time range cannot exceed ${AUDIT_EXPORT_MAX_RANGE_DAYS} days.`,
        errorCode: ErrorCode.InvalidRequestPayload
      });
    }

    return {
      from,
      to
    };
  }

  private toAuditLogsCsv(logs: ListSuperAdminAuditLogsResponse['logs']) {
    const header = [
      'id',
      'createdAt',
      'action',
      'actorUserEmail',
      'actorUserId',
      'targetTenantSlug',
      'targetTenantId'
    ];

    const rows = logs.map((log) => [
      log.id,
      log.createdAt,
      log.action,
      log.actorUserEmail ?? '',
      log.actorUserId,
      log.targetTenantSlug ?? '',
      log.targetTenantId ?? ''
    ]);

    return [header, ...rows].map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(',')).join('\n');
  }

  private escapeCsvCell(value: string) {
    const escaped = value.replaceAll('"', '""');
    return `"${escaped}"`;
  }
}
