import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SubscriptionOrderSchedulerService } from './subscription-order-scheduler.service';
import { SubscriptionOrdersController } from './subscription-orders.controller';
import { SubscriptionOrdersService } from './subscription-orders.service';
import { WechatPayService } from './wechat-pay.service';

@Module({
  imports: [AuthModule, PrismaModule, ReferralsModule, SubscriptionsModule],
  controllers: [PaymentsController, SubscriptionOrdersController],
  providers: [PaymentsService, WechatPayService, SubscriptionOrdersService, SubscriptionOrderSchedulerService],
  exports: [PaymentsService]
})
export class PaymentsModule {}
