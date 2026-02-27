import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { StorageModule } from '../storage/storage.module';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, AuditLogsModule],
  controllers: [ProductsController],
  providers: [ProductsService]
})
export class ProductsModule {}
