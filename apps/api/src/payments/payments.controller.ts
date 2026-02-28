import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { RequireSuperAdmin } from '../auth/require-super-admin.decorator';
import { SuperAdminGuard } from '../auth/super-admin.guard';

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

  @Post('webhooks/wechat')
  handleWechatWebhook(@Body() body: unknown) {
    return this.paymentsService.handleWechatWebhook(body);
  }

  @Post('webhooks/alipay')
  handleAlipayWebhook(@Body() body: unknown) {
    return this.paymentsService.handleAlipayWebhook(body);
  }
}
