import { BadRequestException, Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ErrorCode, listAuditLogsQuerySchema, listAuditLogsResponseSchema } from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { parseOrThrow } from '../common/zod-parse';

import { AuditLogsService } from './audit-logs.service';

@Controller('audit-logs')
@UseGuards(AuthGuard, RbacGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequireTenantRole('VIEWER')
  async listAuditLogs(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const parsedQuery = parseOrThrow(listAuditLogsQuerySchema, query);

    if (parsedQuery.tenantId && parsedQuery.tenantId !== tenantId) {
      throw new ForbiddenException({
        message: 'Cannot access audit logs from another tenant.',
        errorCode: ErrorCode.Forbidden
      });
    }

    const response = await this.auditLogsService.listLogs(tenantId, parsedQuery);

    return listAuditLogsResponseSchema.parse(response);
  }

  private requireTenantId(tenantId?: string): string {
    if (!tenantId) {
      throw new BadRequestException({
        message: 'No tenant selected in access token.',
        errorCode: ErrorCode.TenantNotSelected
      });
    }

    return tenantId;
  }
}
