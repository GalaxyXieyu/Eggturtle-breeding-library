import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ErrorCode,
  cancelSubscriptionOrderResponseSchema,
  createSubscriptionOrderRequestSchema,
  createSubscriptionOrderResponseSchema,
  getSubscriptionOrderResponseSchema,
} from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RbacGuard } from '../auth/rbac.guard';
import { RequireTenantRole } from '../auth/require-tenant-role.decorator';
import { parseOrThrow } from '../common/zod-parse';

import { SubscriptionOrdersService } from './subscription-orders.service';

@Controller('subscriptions/orders')
@UseGuards(AuthGuard, RbacGuard)
@RequireTenantRole('ADMIN')
export class SubscriptionOrdersController {
  constructor(private readonly subscriptionOrdersService: SubscriptionOrdersService) {}

  @Post()
  async createOrder(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const tenantId = this.requireTenantId(request.tenantId);
    const userId = this.requireUserId(request.user?.id);
    const payload = parseOrThrow(createSubscriptionOrderRequestSchema, body);
    const response = await this.subscriptionOrdersService.createOrder({
      tenantId,
      userId,
      payload,
    });

    return createSubscriptionOrderResponseSchema.parse(response);
  }

  @Get(':orderNo')
  async getOrder(@Req() request: AuthenticatedRequest, @Param('orderNo') orderNo: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const response = await this.subscriptionOrdersService.getOrder(tenantId, orderNo.trim());

    return getSubscriptionOrderResponseSchema.parse(response);
  }

  @Post(':orderNo/cancel')
  @HttpCode(200)
  async cancelOrder(@Req() request: AuthenticatedRequest, @Param('orderNo') orderNo: string) {
    const tenantId = this.requireTenantId(request.tenantId);
    const response = await this.subscriptionOrdersService.cancelOrder(tenantId, orderNo.trim());

    return cancelSubscriptionOrderResponseSchema.parse(response);
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

  private requireUserId(userId?: string): string {
    if (!userId) {
      throw new UnauthorizedException({
        message: 'No user found in access token.',
        errorCode: ErrorCode.Unauthorized,
      });
    }

    return userId;
  }
}
