import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SuperAdminAuditLogsService } from './super-admin-audit-logs.service';

@Module({
  imports: [PrismaModule, AuthModule, SubscriptionsModule],
  controllers: [AdminController],
  providers: [AdminService, SuperAdminAuditLogsService]
})
export class AdminModule {}
