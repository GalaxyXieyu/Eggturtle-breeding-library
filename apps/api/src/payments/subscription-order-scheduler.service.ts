import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { SubscriptionOrdersService } from './subscription-orders.service';

@Injectable()
export class SubscriptionOrderSchedulerService {
  private readonly logger = new Logger(SubscriptionOrderSchedulerService.name);

  constructor(private readonly subscriptionOrdersService: SubscriptionOrdersService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async applyDeferredOrders() {
    const appliedCount = await this.subscriptionOrdersService.applyDeferredOrders();
    if (appliedCount > 0) {
      this.logger.log(`Applied ${appliedCount} deferred subscription order(s).`);
    }
  }
}
