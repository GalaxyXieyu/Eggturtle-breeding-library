import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';

import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, AuthModule],
  controllers: [SharesController],
  providers: [SharesService]
})
export class SharesModule {}
