import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  settleReferralPaidEventRequestSchema,
  settleReferralPaidEventResponseSchema,
} from '@eggturtle/shared';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireSuperAdmin } from '../auth/require-super-admin.decorator';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { parseOrThrow } from '../common/zod-parse';

import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('readiness')
  @UseGuards(AuthGuard, SuperAdminGuard)
  @RequireSuperAdmin()
  getReadiness() {
    return this.paymentsService.getReadiness();
  }

  @Post('referral-events/paid')
  @UseGuards(AuthGuard, SuperAdminGuard)
  @RequireSuperAdmin()
  async settleReferralPaidEvent(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown,
  ) {
    const payload = parseOrThrow(settleReferralPaidEventRequestSchema, body);
    const response = await this.paymentsService.settleReferralPaidEvent(payload, user.id);
    return settleReferralPaidEventResponseSchema.parse(response);
  }

  @Post('webhooks/wechat')
  handleWechatWebhook(@Body() body: unknown) {
    return this.paymentsService.handleWechatWebhook(body);
  }

  @Post('webhooks/alipay')
  handleAlipayWebhook(@Body() body: unknown) {
    return this.paymentsService.handleAlipayWebhook(body);
  }
}
