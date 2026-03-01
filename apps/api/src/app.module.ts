import { Module } from '@nestjs/common';

import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { AdminModule } from './admin/admin.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { FeaturedProductsModule } from './featured-products/featured-products.module';
import { HealthController } from './health.controller';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma.module';
import { ProductsModule } from './products/products.module';
import { SeriesModule } from './series/series.module';
import { SharesModule } from './shares/shares.module';
import { TenantsModule } from './tenants/tenants.module';
import { TenantSharePresentationModule } from './tenant-share-presentation/tenant-share-presentation.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenantsModule,
    PaymentsModule,
    AiAssistantModule,
    ProductsModule,
    SeriesModule,
    FeaturedProductsModule,
    AuditLogsModule,
    SharesModule,
    TenantSharePresentationModule,
    AdminModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
