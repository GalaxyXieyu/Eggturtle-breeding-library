import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ErrorCode,
  dashboardOverviewQuerySchema,
  dashboardOverviewResponseSchema
} from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { TenantSubscriptionGuard } from '../auth/tenant-subscription.guard';
import { parseOrThrow } from '../common/zod-parse';

import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard, RbacGuard, TenantSubscriptionGuard)
@RequireTenantRole('VIEWER')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const parsedQuery = parseOrThrow(dashboardOverviewQuerySchema, query);
    const overview = await this.dashboardService.getOverview(tenantId, parsedQuery.window);

    return dashboardOverviewResponseSchema.parse(overview);
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
