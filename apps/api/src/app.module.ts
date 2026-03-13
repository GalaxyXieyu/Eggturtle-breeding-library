import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { AdminModule } from './admin/admin.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { FeaturedProductsModule } from './featured-products/featured-products.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma.module';
import { BrandingModule } from './branding/branding.module';
import { ProductsModule } from './products/products.module';
import { SeriesModule } from './series/series.module';
import { SharesModule } from './shares/shares.module';
import { TenantsModule } from './tenants/tenants.module';
import { ReferralsModule } from './referrals/referrals.module';
import { TenantSharePresentationModule } from './tenant-share-presentation/tenant-share-presentation.module';
import { TenantWatermarkModule } from './tenant-watermark/tenant-watermark.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TenantsModule,
    PaymentsModule,
    BrandingModule,
    AiAssistantModule,
    ProductsModule,
    SeriesModule,
    FeaturedProductsModule,
    DashboardModule,
    AuditLogsModule,
    SharesModule,
    ReferralsModule,
    TenantSharePresentationModule,
    TenantWatermarkModule,
    AdminModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
