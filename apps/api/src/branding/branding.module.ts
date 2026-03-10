import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { SuperAdminAuditLogsService } from '../admin/super-admin-audit-logs.service';

import { AdminBrandingController } from './admin-branding.controller';
import { BrandingController } from './branding.controller';
import { BrandingService } from './branding.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BrandingController, AdminBrandingController],
  providers: [BrandingService, SuperAdminAuditLogsService],
  exports: [BrandingService],
})
export class BrandingModule {}
