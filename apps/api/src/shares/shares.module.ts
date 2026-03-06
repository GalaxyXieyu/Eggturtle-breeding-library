import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { StorageModule } from '../storage/storage.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TenantSharePresentationModule } from '../tenant-share-presentation/tenant-share-presentation.module';

import { SharesController } from './shares.controller';
import { SharesCoreService } from './shares-core.service';
import { SharesEntryService } from './shares-entry.service';
import { SharesPublicService } from './shares-public.service';

@Module({
  imports: [
    PrismaModule,
    AuditLogsModule,
    AuthModule,
    SubscriptionsModule,
    StorageModule,
    TenantSharePresentationModule
  ],
  controllers: [SharesController],
  providers: [SharesCoreService, SharesEntryService, SharesPublicService]
})
export class SharesModule {}
