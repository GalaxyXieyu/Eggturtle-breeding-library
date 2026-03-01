import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { TenantSharePresentationController } from './tenant-share-presentation.controller';
import { TenantSharePresentationService } from './tenant-share-presentation.service';

@Module({
  imports: [PrismaModule, AuthModule, SubscriptionsModule],
  controllers: [TenantSharePresentationController],
  providers: [TenantSharePresentationService],
  exports: [TenantSharePresentationService]
})
export class TenantSharePresentationModule {}
