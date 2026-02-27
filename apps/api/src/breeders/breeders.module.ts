import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';

import { BreedersController } from './breeders.controller';
import { BreedersService } from './breeders.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BreedersController],
  providers: [BreedersService]
})
export class BreedersModule {}
