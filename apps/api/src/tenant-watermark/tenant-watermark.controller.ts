import { BadRequestException, Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import {
  ErrorCode,
  getTenantWatermarkResponseSchema,
  updateTenantWatermarkRequestSchema,
  updateTenantWatermarkResponseSchema,
} from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { TenantSubscriptionGuard } from '../auth/tenant-subscription.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { parseOrThrow } from '../common/zod-parse';

import { TenantWatermarkService } from './tenant-watermark.service';

@Controller('tenant-watermark')
@UseGuards(AuthGuard, RbacGuard, TenantSubscriptionGuard)
@RequireTenantRole('VIEWER')
export class TenantWatermarkController {
  constructor(private readonly tenantWatermarkService: TenantWatermarkService) {}

  @Get()
  async getTenantWatermark(@Req() request: AuthenticatedRequest) {
    const tenantId = this.requireTenantId(request.tenantId);
    const response = await this.tenantWatermarkService.getTenantWatermarkState(tenantId);
    return getTenantWatermarkResponseSchema.parse(response);
  }

  @Put()
  @RequireTenantRole('EDITOR')
  async updateTenantWatermark(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const payload = parseOrThrow(updateTenantWatermarkRequestSchema, body);
    const response = await this.tenantWatermarkService.updateTenantWatermarkConfig(tenantId, payload.config);
    return updateTenantWatermarkResponseSchema.parse(response);
  }

  private requireTenantId(tenantId?: string): string {
    if (!tenantId) {
      throw new BadRequestException({
        message: 'No tenant selected in access token.',
        errorCode: ErrorCode.TenantNotSelected,
      });
    }

    return tenantId;
  }
}
