import { Controller, Get, Param } from '@nestjs/common';
import {
  getResolvedPlatformBrandingResponseSchema,
  getResolvedTenantBrandingResponseSchema,
} from '@eggturtle/shared';

import { BrandingService } from './branding.service';

@Controller('branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get('platform')
  async getPlatformBranding() {
    const branding = await this.brandingService.getPlatformBranding();
    return getResolvedPlatformBrandingResponseSchema.parse({ branding });
  }

  @Get('tenant/:tenantSlug')
  async getTenantBranding(@Param('tenantSlug') tenantSlug: string) {
    const branding = await this.brandingService.getResolvedTenantBrandingBySlug(tenantSlug);
    return getResolvedTenantBrandingResponseSchema.parse({ branding });
  }
}
