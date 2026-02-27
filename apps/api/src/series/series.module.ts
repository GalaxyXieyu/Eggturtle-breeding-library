import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';

import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SeriesController],
  providers: [SeriesService],
  exports: [SeriesService]
})
export class SeriesModule {}
