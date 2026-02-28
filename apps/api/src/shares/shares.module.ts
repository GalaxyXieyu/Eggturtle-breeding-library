import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { StorageModule } from '../storage/storage.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, AuthModule, SubscriptionsModule, StorageModule],
  controllers: [SharesController],
  providers: [SharesService]
})
export class SharesModule {}
