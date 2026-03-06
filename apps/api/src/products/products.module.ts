import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { StorageModule } from '../storage/storage.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { ProductCertificatesPublicController } from './product-certificates-public.controller';
import { SaleBatchesPublicController } from './sale-batches-public.controller';
import { ProductGeneratedAssetsService } from './product-generated-assets.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, AuditLogsModule, SubscriptionsModule],
  controllers: [ProductsController, ProductCertificatesPublicController, SaleBatchesPublicController],
  providers: [ProductsService, ProductGeneratedAssetsService]
})
export class ProductsModule {}
