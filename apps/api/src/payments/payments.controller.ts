import { Body, Controller, Get, Headers, Post, Req, Res, UseGuards } from '@nestjs/common';
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

type RawBodyRequest = {
  rawBody?: Buffer;
  body?: unknown;
};

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
  async handleWechatWebhook(
    @Req() request: RawBodyRequest,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res() response: { status: (code: number) => { json: (payload: unknown) => unknown } },
  ) {
    const rawBody = request.rawBody?.toString('utf8') ?? JSON.stringify(request.body ?? {});

    try {
      await this.paymentsService.handleWechatWebhook(headers, rawBody);
      return response.status(200).json({
        code: 'SUCCESS',
        message: '成功',
      });
    } catch (error) {
      return response.status(500).json({
        code: 'ERROR',
        message: (error as Error)?.message ?? '处理失败',
      });
    }
  }

  @Post('webhooks/alipay')
  handleAlipayWebhook(@Body() body: unknown) {
    return this.paymentsService.handleAlipayWebhook(body);
  }
}
