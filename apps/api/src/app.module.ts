import { Module } from '@nestjs/common';

import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { FeaturedProductsModule } from './featured-products/featured-products.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma.module';
import { ProductsModule } from './products/products.module';
import { TenantsModule } from './tenants/tenants.module';

@Module({
  imports: [PrismaModule, AuthModule, TenantsModule, ProductsModule, FeaturedProductsModule, AuditLogsModule],
  controllers: [HealthController]
})
export class AppModule {}
