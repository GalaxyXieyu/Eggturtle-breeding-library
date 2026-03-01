import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import {
  ErrorCode,
  getTenantSharePresentationResponseSchema,
  updateTenantSharePresentationRequestSchema,
  updateTenantSharePresentationResponseSchema
} from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { TenantSubscriptionGuard } from '../auth/tenant-subscription.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { parseOrThrow } from '../common/zod-parse';

import { TenantSharePresentationService } from './tenant-share-presentation.service';

@Controller('tenant-share-presentation')
@UseGuards(AuthGuard, RbacGuard, TenantSubscriptionGuard)
@RequireTenantRole('VIEWER')
export class TenantSharePresentationController {
  constructor(private readonly tenantSharePresentationService: TenantSharePresentationService) {}

  @Get()
  async getTenantPresentation(@Req() request: AuthenticatedRequest) {
    const tenantId = this.requireTenantId(request.tenantId);
    const presentation = await this.tenantSharePresentationService.getTenantTemplate(tenantId);

    return getTenantSharePresentationResponseSchema.parse({
      presentation
    });
  }

  @Put()
  @RequireTenantRole('EDITOR')
  async updateTenantPresentation(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const payload = parseOrThrow(updateTenantSharePresentationRequestSchema, body);

    const presentation = await this.tenantSharePresentationService.upsertTenantTemplate(
      tenantId,
      payload.presentation
    );

    return updateTenantSharePresentationResponseSchema.parse({
      presentation
    });
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
