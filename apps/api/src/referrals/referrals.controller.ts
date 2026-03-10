import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  bindReferralRequestSchema,
  bindReferralResponseSchema,
  myReferralOverviewResponseSchema,
  publicReferralLandingResponseSchema,
} from '@eggturtle/shared';

import { parseOrThrow } from '../common/zod-parse';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

import { ReferralsService } from './referrals.service';

@Controller()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('me/referral')
  @UseGuards(AuthGuard)
  async getMyReferralOverview(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
  ) {
    const response = await this.referralsService.getMyReferralOverview(user.id);
    return myReferralOverviewResponseSchema.parse(response);
  }

  @Post('referrals/bind')
  @UseGuards(AuthGuard)
  async bindReferral(
    @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>,
    @Body() body: unknown,
  ) {
    const payload = parseOrThrow(bindReferralRequestSchema, body);
    const response = await this.referralsService.bindReferral(
      user.id,
      payload.referralCode,
      payload.source ?? 'manual_fallback',
    );
    return bindReferralResponseSchema.parse(response);
  }

  @Get('public/referrals/:referralCode')
  async getPublicReferralLanding(@Param('referralCode') referralCode: string) {
    const response = await this.referralsService.getPublicReferralLanding(referralCode);
    return publicReferralLandingResponseSchema.parse(response);
  }
}
