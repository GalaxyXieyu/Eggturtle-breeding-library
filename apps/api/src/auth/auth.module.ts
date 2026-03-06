import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { AuthAccessService } from './auth-access.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthIdentityService } from './auth-identity.service';
import { AuthProfileService } from './auth-profile.service';
import { AuthSharedService } from './auth-shared.service';
import { JwtTokenService } from './jwt-token.service';
import { MeController } from './me.controller';
import { RbacGuard } from './rbac.guard';
import { SmsVerificationService } from './sms-verification.service';
import { SuperAdminGuard } from './super-admin.guard';
import { SubscriptionActivationCodesController } from './subscription-activation-codes.controller';
import { TenantSubscriptionGuard } from './tenant-subscription.guard';

@Module({
  imports: [PrismaModule, SubscriptionsModule],
  controllers: [AuthController, MeController, SubscriptionActivationCodesController],
  providers: [
    AuthSharedService,
    AuthAccessService,
    AuthIdentityService,
    AuthProfileService,
    AuthGuard,
    RbacGuard,
    SuperAdminGuard,
    TenantSubscriptionGuard,
    JwtTokenService,
    SmsVerificationService
  ],
  exports: [AuthGuard, RbacGuard, SuperAdminGuard, TenantSubscriptionGuard, AuthAccessService]
})
export class AuthModule {}
