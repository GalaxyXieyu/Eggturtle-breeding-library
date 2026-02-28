import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import {
  ErrorCode,
  redeemTenantSubscriptionActivationCodeRequestSchema,
  redeemTenantSubscriptionActivationCodeResponseSchema
} from '@eggturtle/shared';

import { parseOrThrow } from '../common/zod-parse';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { RbacGuard } from './rbac.guard';
import { RequireTenantRole } from './require-tenant-role.decorator';

@Controller('subscriptions/activation-codes')
@UseGuards(AuthGuard, RbacGuard)
@RequireTenantRole('OWNER')
export class SubscriptionActivationCodesController {
  constructor(private readonly tenantSubscriptionsService: TenantSubscriptionsService) {}

  @Post('redeem')
  @HttpCode(200)
  async redeem(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const actorUserId = this.requireUserId(request.user?.id);
    const payload = parseOrThrow(redeemTenantSubscriptionActivationCodeRequestSchema, body);
    const response = await this.tenantSubscriptionsService.redeemSubscriptionActivationCode(
      tenantId,
      actorUserId,
      payload.code
    );

    return redeemTenantSubscriptionActivationCodeResponseSchema.parse(response);
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

  private requireUserId(userId?: string): string {
    if (!userId) {
      throw new UnauthorizedException({
        message: 'No user found in access token.',
        errorCode: ErrorCode.Unauthorized
      });
    }

    return userId;
  }
}
