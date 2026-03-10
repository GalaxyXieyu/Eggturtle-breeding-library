import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
  getAdminTenantBrandingResponseSchema,
  getPlatformBrandingResponseSchema,
  updateAdminTenantBrandingRequestSchema,
  updateAdminTenantBrandingResponseSchema,
  updatePlatformBrandingRequestSchema,
  updatePlatformBrandingResponseSchema,
} from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RequireSuperAdmin } from '../auth/require-super-admin.decorator';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { parseOrThrow } from '../common/zod-parse';

import { BrandingService } from './branding.service';

@Controller('admin/branding')
@UseGuards(AuthGuard, SuperAdminGuard)
@RequireSuperAdmin()
export class AdminBrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get('platform')
  async getPlatformBranding(@CurrentUser() user: NonNullable<AuthenticatedRequest['user']>) {
    const branding = await this.brandingService.getPlatformBranding(user.id);
    return getPlatformBrandingResponseSchema.parse({ branding });
  }

  @Put('platform')
  async updatePlatformBranding(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown,
  ) {
    const payload = parseOrThrow(updatePlatformBrandingRequestSchema, body);
    const response = await this.brandingService.updatePlatformBranding(user.id, payload.branding);
    return updatePlatformBrandingResponseSchema.parse(response);
  }

  @Get('tenants/:tenantId')
  async getTenantBranding(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string,
  ) {
    const response = await this.brandingService.getAdminTenantBranding(user.id, tenantId);
    return getAdminTenantBrandingResponseSchema.parse(response);
  }

  @Put('tenants/:tenantId')
  async updateTenantBranding(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Param('tenantId') tenantId: string,
    @Body() body: unknown,
  ) {
    const payload = parseOrThrow(updateAdminTenantBrandingRequestSchema, body);
    const response = await this.brandingService.updateAdminTenantBranding(
      user.id,
      tenantId,
      payload.branding,
    );
    return updateAdminTenantBrandingResponseSchema.parse(response);
  }
}
