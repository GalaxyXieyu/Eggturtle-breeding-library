import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  createTenantRequestSchema,
  createTenantResponseSchema,
  currentTenantResponseSchema,
  myTenantsResponseSchema
} from '@eggturtle/shared';

import { parseOrThrow } from '../common/zod-parse';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(AuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  async createTenant(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(createTenantRequestSchema, body);
    const response = await this.tenantsService.createTenant(user, payload);

    return createTenantResponseSchema.parse(response);
  }

  @Get('me')
  async getMyTenants(@CurrentUser() user: NonNullable<AuthenticatedRequest['user']>) {
    const tenants = await this.tenantsService.listMyTenants(user.id);

    return myTenantsResponseSchema.parse({ tenants });
  }

  @Get('current')
  async getCurrentTenant(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Req() request: AuthenticatedRequest
  ) {
    const response = await this.tenantsService.getCurrentTenant(user.id, request.tenantId);

    return currentTenantResponseSchema.parse(response);
  }
}
