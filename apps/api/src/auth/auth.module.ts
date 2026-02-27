import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma.module';

import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { JwtTokenService } from './jwt-token.service';
import { MeController } from './me.controller';
import { RbacGuard } from './rbac.guard';
import { SuperAdminGuard } from './super-admin.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, MeController],
  providers: [AuthService, AuthGuard, RbacGuard, SuperAdminGuard, JwtTokenService],
  exports: [AuthGuard, RbacGuard, SuperAdminGuard, AuthService]
})
export class AuthModule {}
