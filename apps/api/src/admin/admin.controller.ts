import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  createAdminTenantRequestSchema,
  createAdminTenantResponseSchema,
  deleteTenantMemberResponseSchema,
  getAdminTenantResponseSchema,
  getAdminTenantSubscriptionResponseSchema,
  listAdminTenantMembersQuerySchema,
  listAdminTenantMembersResponseSchema,
  listAdminTenantsQuerySchema,
  listAdminTenantsResponseSchema,
  listAdminUsersResponseSchema,
  listSuperAdminAuditLogsQuerySchema,
  listSuperAdminAuditLogsResponseSchema,
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
}
