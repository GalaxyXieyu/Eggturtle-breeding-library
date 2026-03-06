import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminController } from './admin.controller';
import { AdminTenantsService } from './admin-tenants.service';
import { SuperAdminAuditLogsService } from './super-admin-audit-logs.service';

@Module({
  imports: [PrismaModule, AuthModule, SubscriptionsModule],
  controllers: [AdminController],
  providers: [AdminTenantsService, AdminAnalyticsService, AdminAuditService, SuperAdminAuditLogsService]
})
export class AdminModule {}
