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
  meResponseSchema,
  meSubscriptionResponseSchema,
  updateMeProfileRequestSchema,
  updateMeProfileResponseSchema,
  updateMyPasswordRequestSchema,
  updateMyPasswordResponseSchema
} from '@eggturtle/shared';

import { parseOrThrow } from '../common/zod-parse';
import { TenantSubscriptionsService } from '../subscriptions/tenant-subscriptions.service';

import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedRequest } from './auth.types';
import { AuthService } from './auth.service';

@Controller()
@UseGuards(AuthGuard)
export class MeController {
  constructor(
    private readonly authService: AuthService,
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
    const profile = await this.authService.getMyProfile(user.id);
    return meProfileResponseSchema.parse({ profile });
  }

  @Put('me/profile')
  async updateMyProfile(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(updateMeProfileRequestSchema, body);
    const profile = await this.authService.updateMyProfile(user.id, payload);
    return updateMeProfileResponseSchema.parse({ profile });
  }

  @Put('me/password')
  async updateMyPassword(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown
  ) {
    const payload = parseOrThrow(updateMyPasswordRequestSchema, body);
    const response = await this.authService.updateMyPassword(user.id, payload);
    return updateMyPasswordResponseSchema.parse({
      ok: true,
      passwordUpdatedAt: response.passwordUpdatedAt
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
