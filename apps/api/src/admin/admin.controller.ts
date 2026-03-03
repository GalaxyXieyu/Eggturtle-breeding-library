import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import {
  adminRevenueOverviewResponseSchema,
  adminUsageOverviewResponseSchema,
  createTenantSubscriptionActivationCodeRequestSchema,
  createTenantSubscriptionActivationCodeResponseSchema,
  createAdminTenantRequestSchema,
  createAdminTenantResponseSchema,
  deleteTenantMemberResponseSchema,
  adminActivityOverviewResponseSchema,
  exportSuperAdminAuditLogsQuerySchema,
  getAdminActivityOverviewQuerySchema,
  getAdminRevenueOverviewQuerySchema,
  getAdminTenantResponseSchema,
  getAdminTenantSubscriptionResponseSchema,
  getAdminTenantUsageResponseSchema,
  getAdminUsageOverviewQuerySchema,
  offboardAdminTenantRequestSchema,
  offboardAdminTenantResponseSchema,
  reactivateAdminTenantResponseSchema,
  listAdminTenantMembersQuerySchema,
  listAdminTenantMembersResponseSchema,
  listAdminTenantsQuerySchema,
  listAdminTenantsResponseSchema,
  listAdminUsersResponseSchema,
  listSuperAdminAuditLogsQuerySchema,
  listSuperAdminAuditLogsResponseSchema,
  suspendAdminTenantRequestSchema,
  suspendAdminTenantResponseSchema,
  updateTenantSubscriptionRequestSchema,
  updateTenantSubscriptionResponseSchema,
  upsertTenantMemberRequestSchema,
  upsertTenantMemberResponseSchema
} from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireSuperAdmin } from '../auth/require-super-admin.decorator';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { parseOrThrow } from '../common/zod-parse';

import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard, SuperAdminGuard)
@RequireSuperAdmin()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tenants')
  async listTenants(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Query() query: unknown
  ) {
    const parsedQuery = parseOrThrow(listAdminTenantsQuerySchema, query);
    const response = await this.adminService.listTenants(user.id, parsedQuery);
    return listAdminTenantsResponseSchema.parse(response);
  }

  @Get('tenants/:tenantId')
  async getTenant(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string
  ) {
    const response = await this.adminService.getTenant(user.id, tenantId);
    return getAdminTenantResponseSchema.parse(response);
  }

  @Get('tenants/:tenantId/subscription')
  async getTenantSubscription(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string
  ) {
    const response = await this.adminService.getTenantSubscription(user.id, tenantId);
    return getAdminTenantSubscriptionResponseSchema.parse(response);
  }

  @Put('tenants/:tenantId/subscription')
  async updateTenantSubscription(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(updateTenantSubscriptionRequestSchema, body);
    const response = await this.adminService.updateTenantSubscription(user.id, tenantId, payload);

    return updateTenantSubscriptionResponseSchema.parse(response);
  }

  @Post('tenants/:tenantId/lifecycle/suspend')
  async suspendTenant(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(suspendAdminTenantRequestSchema, body);
    const response = await this.adminService.suspendTenant(user.id, tenantId, payload);

    return suspendAdminTenantResponseSchema.parse(response);
  }

  @Post('tenants/:tenantId/lifecycle/reactivate')
  async reactivateTenant(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string
  ) {
    const response = await this.adminService.reactivateTenant(user.id, tenantId);

    return reactivateAdminTenantResponseSchema.parse(response);
  }

  @Post('tenants/:tenantId/lifecycle/offboard')
  async offboardTenant(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(offboardAdminTenantRequestSchema, body);
    const response = await this.adminService.offboardTenant(user.id, tenantId, payload);

    return offboardAdminTenantResponseSchema.parse(response);
  }

  @Post('subscription-activation-codes')
  async createSubscriptionActivationCode(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(createTenantSubscriptionActivationCodeRequestSchema, body);
    const response = await this.adminService.createSubscriptionActivationCode(user.id, payload);
    return createTenantSubscriptionActivationCodeResponseSchema.parse(response);
  }

  @Post('tenants')
  async createTenant(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(createAdminTenantRequestSchema, body);
    const response = await this.adminService.createTenant(user.id, payload);

    return createAdminTenantResponseSchema.parse(response);
  }

  @Get('users')
  async listUsers(@CurrentUser() user: NonNullable<AuthenticatedRequest['user']>) {
    const response = await this.adminService.listUsers(user.id);
    return listAdminUsersResponseSchema.parse(response);
  }

  @Get('tenants/:tenantId/members')
  async listTenantMembers(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string,
    @Query() query: unknown
  ) {
    const parsedQuery = parseOrThrow(listAdminTenantMembersQuerySchema, query);
    const response = await this.adminService.listTenantMembers(user.id, tenantId, parsedQuery);

    return listAdminTenantMembersResponseSchema.parse(response);
  }

  @Post('tenants/:tenantId/members')
  async upsertTenantMember(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(upsertTenantMemberRequestSchema, body);
    const response = await this.adminService.upsertTenantMember(user.id, tenantId, payload);

    return upsertTenantMemberResponseSchema.parse(response);
  }

  @Delete('tenants/:tenantId/members/:userId')
  async deleteTenantMember(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string
  ) {
    const response = await this.adminService.deleteTenantMember(user.id, tenantId, userId);

    return deleteTenantMemberResponseSchema.parse(response);
  }

  @Get('audit-logs')
  async listAuditLogs(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Query() query: unknown
  ) {
    const parsedQuery = parseOrThrow(listSuperAdminAuditLogsQuerySchema, query);
    const response = await this.adminService.listAuditLogs(user.id, parsedQuery);

    return listSuperAdminAuditLogsResponseSchema.parse(response);
  }

  @Get('analytics/activity/overview')
  async getActivityOverview(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Query() query: unknown
  ) {
    const parsedQuery = parseOrThrow(getAdminActivityOverviewQuerySchema, query);
    const response = await this.adminService.getActivityOverview(user.id, parsedQuery);

    return adminActivityOverviewResponseSchema.parse(response);
  }

  @Get('analytics/usage/overview')
  async getUsageOverview(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Query() query: unknown
  ) {
    const parsedQuery = parseOrThrow(getAdminUsageOverviewQuerySchema, query);
    const response = await this.adminService.getUsageOverview(user.id, parsedQuery);

    return adminUsageOverviewResponseSchema.parse(response);
  }

  @Get('tenants/:tenantId/usage')
  async getTenantUsage(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string
  ) {
    const response = await this.adminService.getTenantUsage(user.id, tenantId);

    return getAdminTenantUsageResponseSchema.parse(response);
  }

  @Get('analytics/revenue/overview')
  async getRevenueOverview(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Query() query: unknown
  ) {
    const parsedQuery = parseOrThrow(getAdminRevenueOverviewQuerySchema, query);
    const response = await this.adminService.getRevenueOverview(user.id, parsedQuery);

    return adminRevenueOverviewResponseSchema.parse(response);
  }

  @Get('audit-logs/export')
  async exportAuditLogs(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Query() query: unknown,
    @Res()
    response: {
      setHeader: (name: string, value: string) => unknown;
      send: (body: string) => unknown;
    }
  ) {
    const parsedQuery = parseOrThrow(exportSuperAdminAuditLogsQuerySchema, query);
    const result = await this.adminService.exportAuditLogs(user.id, parsedQuery);
    const filename = `audit-logs-${new Date().toISOString().replaceAll(':', '-').slice(0, 19)}.csv`;

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('X-Export-Row-Count', String(result.rowCount));
    response.setHeader('X-Export-Truncated', result.truncated ? '1' : '0');
    response.send(`\uFEFF${result.csv}`);
  }
}
