import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards
} from '@nestjs/common';
import {
    ErrorCode,
    meProfileResponseSchema,
    myPhoneBindingResponseSchema,
    mySecurityProfileResponseSchema,
    meResponseSchema,
    meSubscriptionResponseSchema,
    upsertMyPhoneBindingRequestSchema,
    upsertMyPhoneBindingResponseSchema,
    upsertMySecurityProfileRequestSchema,
    upsertMySecurityProfileResponseSchema,
  updateMeProfileRequestSchema,
  updateMeProfileResponseSchema,
  updateMyPasswordRequestSchema,
  updateMyPasswordResponseSchema
} from '@eggturtle/shared';

import { parseOrThrow } from '../common/zod-parse';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

import { AuthGuard } from './auth.guard';
import { AuthProfileService } from './auth-profile.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedRequest } from './auth.types';

@Controller()
@UseGuards(AuthGuard)
export class MeController {
  constructor(
    private readonly authProfileService: AuthProfileService,
    private readonly tenantSubscriptionsService: TenantSubscriptionsService
  ) {}

  @Get('me')
  getMe(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Req() request: AuthenticatedRequest
  ) {
    return meResponseSchema.parse({
      user,
      tenantId: request.tenantId ?? null
    });
  }

  @Get('me/profile')
  async getMyProfile(@CurrentUser() user: NonNullable<AuthenticatedRequest['user']>) {
    const profile = await this.authProfileService.getMyProfile(user.id);
    return meProfileResponseSchema.parse({ profile });
  }

  @Put('me/profile')
  async updateMyProfile(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(updateMeProfileRequestSchema, body);
    const profile = await this.authProfileService.updateMyProfile(user.id, payload);
    return updateMeProfileResponseSchema.parse({ profile });
  }

  @Put('me/password')
  async updateMyPassword(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(updateMyPasswordRequestSchema, body);
    const response = await this.authProfileService.updateMyPassword(user.id, payload);
    return updateMyPasswordResponseSchema.parse({
      ok: true,
      passwordUpdatedAt: response.passwordUpdatedAt
    });
  }

  @Get('me/security-profile')
  async getMySecurityProfile(@CurrentUser() user: NonNullable<AuthenticatedRequest['user']>) {
    const profile = await this.authProfileService.getMySecurityProfile(user.id);
    return mySecurityProfileResponseSchema.parse({ profile });
  }

  @Put('me/security-profile')
  async upsertMySecurityProfile(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(upsertMySecurityProfileRequestSchema, body);
    const response = await this.authProfileService.upsertMySecurityProfile(user.id, payload);
    return upsertMySecurityProfileResponseSchema.parse({
      ok: true,
      updatedAt: response.updatedAt
    });
  }

  @Get('me/phone-binding')
  async getMyPhoneBinding(@CurrentUser() user: NonNullable<AuthenticatedRequest['user']>) {
    const binding = await this.authProfileService.getMyPhoneBinding(user.id);
    return myPhoneBindingResponseSchema.parse({ binding });
  }

  @Put('me/phone-binding')
  async upsertMyPhoneBinding(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(upsertMyPhoneBindingRequestSchema, body);
    const response = await this.authProfileService.upsertMyPhoneBinding(user.id, payload);
    return upsertMyPhoneBindingResponseSchema.parse({
      ok: true,
      binding: response
    });
  }

  @Get('me/subscription')
  async getMyTenantSubscription(@Req() request: AuthenticatedRequest) {
    const tenantId = this.requireTenantId(request.tenantId);
    const subscription = await this.tenantSubscriptionsService.getSubscriptionForTenant(tenantId);
    return meSubscriptionResponseSchema.parse({ subscription });
  }

  private requireTenantId(tenantId?: string): string {
    if (!tenantId) {
      throw new BadRequestException({
        message: 'No tenant selected in access token.',
        errorCode: ErrorCode.TenantNotSelected
      });
    }

    return tenantId;
  }
}
