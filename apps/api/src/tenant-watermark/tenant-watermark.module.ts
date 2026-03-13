import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { TenantWatermarkController } from './tenant-watermark.controller';
import { TenantWatermarkService } from './tenant-watermark.service';

@Module({
  imports: [PrismaModule, AuthModule, SubscriptionsModule],
  controllers: [TenantWatermarkController],
  providers: [TenantWatermarkService],
  exports: [TenantWatermarkService],
})
export class TenantWatermarkModule {}
