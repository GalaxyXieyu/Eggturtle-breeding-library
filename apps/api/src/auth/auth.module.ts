import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { JwtTokenService } from './jwt-token.service';
import { MeController } from './me.controller';
import { RbacGuard } from './rbac.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { TenantSubscriptionGuard } from './tenant-subscription.guard';

@Module({
  imports: [PrismaModule, SubscriptionsModule],
  controllers: [AuthController, MeController],
  providers: [AuthService, AuthGuard, RbacGuard, SuperAdminGuard, TenantSubscriptionGuard, JwtTokenService],
  exports: [AuthGuard, RbacGuard, SuperAdminGuard, TenantSubscriptionGuard, AuthService]
})
export class AuthModule {}
