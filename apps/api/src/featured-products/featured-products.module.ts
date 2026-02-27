import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';

import { FeaturedProductsController } from './featured-products.controller';
import { FeaturedProductsService } from './featured-products.service';
import { ProductsPublicController } from './products-public.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FeaturedProductsController, ProductsPublicController],
  providers: [FeaturedProductsService]
})
export class FeaturedProductsModule {}
