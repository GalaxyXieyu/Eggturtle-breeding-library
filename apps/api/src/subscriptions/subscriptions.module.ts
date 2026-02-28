import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma.module';

import { TenantSubscriptionsService } from './tenant-subscriptions.service';

@Module({
  imports: [PrismaModule],
  providers: [TenantSubscriptionsService],
  exports: [TenantSubscriptionsService]
})
export class SubscriptionsModule {}
