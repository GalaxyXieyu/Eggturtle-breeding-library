import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { BrandingModule } from '../branding/branding.module';
import { PrismaModule } from '../prisma.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { SharesCoreService } from '../shares/shares-core.service';
import { StorageModule } from '../storage/storage.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { ProductCertificatesPublicController } from './product-certificates-public.controller';
import { ProductCertificateVerificationService } from './product-certificate-verification.service';
import { ProductCertificatesService } from './product-certificates.service';
import { ProductCouplePhotosService } from './product-couple-photos.service';
import { ProductGeneratedAssetsSupportService } from './product-generated-assets-support.service';
import { ProductsEventsService } from './products-events.service';
import { ProductsImagesService } from './products-images.service';
import { ProductsReadService } from './products-read.service';
import { ProductSaleBatchesService } from './product-sale-batches.service';
import { SaleBatchesPublicController } from './sale-batches-public.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, AuditLogsModule, SubscriptionsModule, BrandingModule, ReferralsModule],
  controllers: [ProductsController, ProductCertificatesPublicController, SaleBatchesPublicController],
  providers: [
    ProductsService,
    ProductsReadService,
    ProductsEventsService,
    ProductsImagesService,
    ProductGeneratedAssetsSupportService,
    ProductCertificatesService,
    ProductCertificateVerificationService,
    ProductSaleBatchesService,
    ProductCouplePhotosService,
    SharesCoreService,
  ]
})
export class ProductsModule {}
