import { meSubscriptionResponseSchema, registerResponseSchema } from '../../packages/shared/src/auth';
import {
  bindReferralFromAttributionResponseSchema,
  bindReferralResponseSchema,
  myReferralOverviewResponseSchema,
  publicReferralLandingResponseSchema,
  settleReferralPaidEventResponseSchema,
} from '../../packages/shared/src/referral';
import { createProductResponseSchema } from '../../packages/shared/src/product';

import {
  ApiTestError,
  ModuleResult,
  TestContext,
  TestModule,
  assertErrorCode,
  assertStatus,
  loginWithDevCode,
  requestSmsCode,
  uniqueSuffix,
} from './lib';

type RegisteredUser = {
  token: string;
  userId: string;
  tenantId: string;
  tenantSlug: string;
};

let accountCounter = 0;
let phoneCounter = 0;

export const referralsModule: TestModule = {
  name: 'referrals',
  description:
    'Public-page attribution auto-bind, first-product reward settlement, reward idempotency, and paid-order fallback checks',
  requiresWrites: true,
  run,
};

async function run(ctx: TestContext): Promise<ModuleResult> {
  ctx.requireWrites('referrals');

  let checks = 0;

  const inviter = await registerFreshUser(ctx, 'refinviter');
  checks += 1;

  const inviterOverview = await getReferralOverview(ctx, inviter.token, 'referrals.inviter.overview-initial');
  checks += 1;
  if (!inviterOverview.referralCode || inviterOverview.invitedCount !== 0) {
    throw new ApiTestError('referrals.inviter.overview-initial expected referralCode and zero invitedCount');
  }
  if (inviterOverview.rules.rewardMode !== 'first_product_create') {
    throw new ApiTestError('referrals.inviter.overview-initial expected rewardMode=first_product_create');
  }

  const publicLandingResponse = await ctx.request({
    method: 'GET',
    path: `/public/referrals/${encodeURIComponent(inviterOverview.referralCode)}`,
  });
  assertStatus(publicLandingResponse, 200, 'referrals.public-landing');
  const publicLanding = publicReferralLandingResponseSchema.parse(publicLandingResponse.body);
  if (publicLanding.referralCode !== inviterOverview.referralCode) {
    throw new ApiTestError('referrals.public-landing referralCode mismatch');
  }
  checks += 1;

  const selfBindResponse = await ctx.request({
    method: 'POST',
    path: '/referrals/bind',
    token: inviter.token,
    json: {
      referralCode: inviterOverview.referralCode,
      source: 'manual_fallback',
    },
  });
  assertStatus(selfBindResponse, 403, 'referrals.self-bind-denied');
  assertErrorCode(selfBindResponse, 'FORBIDDEN');
  checks += 1;

  const invitee = await registerFreshUser(ctx, 'refinvitee');
  checks += 1;

  const inviteeSubscriptionBefore = await getMySubscription(
    ctx,
    invitee.token,
    'referrals.invitee.subscription-before-reward',
  );
  const inviterSubscriptionBefore = await getMySubscription(
    ctx,
    inviter.token,
    'referrals.inviter.subscription-before-reward',
  );
  checks += 2;

  const autoBindResponse = await ctx.request({
    method: 'POST',
    path: '/referrals/bind-from-attribution',
    token: invitee.token,
    json: {
      fromUrl: `https://example.com/public/${encodeURIComponent(inviter.tenantSlug)}?src=poster`,
      pageType: 'tenant_feed',
      tenantSlug: inviter.tenantSlug,
      entrySource: 'poster',
      capturedAt: new Date().toISOString(),
    },
  });
  assertStatus(autoBindResponse, 201, 'referrals.bind-from-attribution');
  const autoBind = bindReferralFromAttributionResponseSchema.parse(autoBindResponse.body);
  if (!autoBind.binding || autoBind.binding.referrerUserId !== inviter.userId || autoBind.binding.inviteeUserId !== invitee.userId) {
    throw new ApiTestError('referrals.bind-from-attribution expected inviter/invitee binding');
  }
  checks += 1;

  const autoBindReplayResponse = await ctx.request({
    method: 'POST',
    path: '/referrals/bind-from-attribution',
    token: invitee.token,
    json: {
      fromUrl: `https://example.com/public/${encodeURIComponent(inviter.tenantSlug)}/products/demo-product?src=poster`,
      pageType: 'tenant_product',
      tenantSlug: inviter.tenantSlug,
      productId: 'demo-product',
      entrySource: 'poster',
      capturedAt: new Date().toISOString(),
    },
  });
  assertStatus(autoBindReplayResponse, 201, 'referrals.bind-from-attribution-replay');
  const autoBindReplay = bindReferralFromAttributionResponseSchema.parse(autoBindReplayResponse.body);
  if (!autoBindReplay.binding || autoBindReplay.binding.id !== autoBind.binding.id) {
    throw new ApiTestError('referrals.bind-from-attribution-replay expected same binding id');
  }
  checks += 1;

  const inviterAfterBind = await getReferralOverview(ctx, inviter.token, 'referrals.inviter.overview-after-bind');
  checks += 1;
  if (inviterAfterBind.invitedCount !== 1 || inviterAfterBind.activatedInviteeCount !== 0) {
    throw new ApiTestError('referrals.inviter.overview-after-bind expected invited=1 activated=0');
  }

  const inviteeAfterBind = await getReferralOverview(ctx, invitee.token, 'referrals.invitee.overview-after-bind');
  checks += 1;
  if (!inviteeAfterBind.binding || inviteeAfterBind.binding.referralCode !== inviterOverview.referralCode) {
    throw new ApiTestError('referrals.invitee.overview-after-bind missing binding');
  }

  const firstProductResponse = await ctx.request({
    method: 'POST',
    path: '/products',
    token: invitee.token,
    json: {
      code: uniqueSuffix('refa').replace(/-/g, '').slice(0, 18).toUpperCase(),
      name: `Referral Reward ${Date.now()}`,
      description: 'Referral first product reward fixture',
    },
  });
  assertStatus(firstProductResponse, 201, 'referrals.invitee.first-product-create');
  const firstProduct = createProductResponseSchema.parse(firstProductResponse.body);
  if (!firstProduct.referralReward || firstProduct.referralReward.triggerType !== 'first_product_create') {
    throw new ApiTestError('referrals.invitee.first-product-create expected first_product_create reward');
  }
  if (firstProduct.referralReward.status !== 'AWARDED') {
    throw new ApiTestError('referrals.invitee.first-product-create expected AWARDED reward');
  }
  if (firstProduct.referralReward.rewardDaysReferrer !== 7 || firstProduct.referralReward.rewardDaysInvitee !== 7) {
    throw new ApiTestError('referrals.invitee.first-product-create expected reward days 7/7');
  }
  checks += 1;

  const secondProductResponse = await ctx.request({
    method: 'POST',
    path: '/products',
    token: invitee.token,
    json: {
      code: uniqueSuffix('refb').replace(/-/g, '').slice(0, 18).toUpperCase(),
      name: `Referral Noop ${Date.now()}`,
      description: 'Referral second product noop fixture',
    },
  });
  assertStatus(secondProductResponse, 201, 'referrals.invitee.second-product-create');
  const secondProduct = createProductResponseSchema.parse(secondProductResponse.body);
  if (secondProduct.referralReward !== null && secondProduct.referralReward !== undefined) {
    throw new ApiTestError('referrals.invitee.second-product-create expected no referral reward');
  }
  checks += 1;

  const inviterSubscriptionAfter = await getMySubscription(
    ctx,
    inviter.token,
    'referrals.inviter.subscription-after-reward',
  );
  const inviteeSubscriptionAfter = await getMySubscription(
    ctx,
    invitee.token,
    'referrals.invitee.subscription-after-reward',
  );
  checks += 2;
  const inviterExpiryAfter = requireExpiresAtMs(
    inviterSubscriptionAfter.subscription.expiresAt,
    'referrals.inviter.subscription-after-reward',
  );
  const inviteeExpiryAfter = requireExpiresAtMs(
    inviteeSubscriptionAfter.subscription.expiresAt,
    'referrals.invitee.subscription-after-reward',
  );
  if (inviterSubscriptionBefore.subscription.expiresAt && inviterExpiryAfter <= Date.parse(inviterSubscriptionBefore.subscription.expiresAt)) {
    throw new ApiTestError('referrals.inviter.subscription-after-reward expected later expiry');
  }
  if (inviteeSubscriptionBefore.subscription.expiresAt && inviteeExpiryAfter <= Date.parse(inviteeSubscriptionBefore.subscription.expiresAt)) {
    throw new ApiTestError('referrals.invitee.subscription-after-reward expected later expiry');
  }

  const inviterAfterReward = await getReferralOverview(ctx, inviter.token, 'referrals.inviter.overview-after-reward');
  checks += 1;
  if (inviterAfterReward.activatedInviteeCount !== 1) {
    throw new ApiTestError('referrals.inviter.overview-after-reward expected activatedInviteeCount=1');
  }
  if (!inviterAfterReward.invites[0] || inviterAfterReward.invites[0].status !== 'reward_awarded') {
    throw new ApiTestError('referrals.inviter.overview-after-reward expected invite status reward_awarded');
  }
  if (!inviterAfterReward.rewards.some((reward) => reward.triggerType === 'first_product_create')) {
    throw new ApiTestError('referrals.inviter.overview-after-reward expected first_product_create reward record');
  }

  const manualInvitee = await registerFreshUser(ctx, 'refmanual');
  checks += 1;
  const manualBindResponse = await ctx.request({
    method: 'POST',
    path: '/referrals/bind',
    token: manualInvitee.token,
    json: {
      referralCode: inviterOverview.referralCode,
      source: 'share_link',
    },
  });
  assertStatus(manualBindResponse, 201, 'referrals.manual-bind');
  const manualBinding = bindReferralResponseSchema.parse(manualBindResponse.body).binding;
  if (manualBinding.referrerUserId !== inviter.userId || manualBinding.inviteeUserId !== manualInvitee.userId) {
    throw new ApiTestError('referrals.manual-bind relation mismatch');
  }
  checks += 1;

  let paidEventSkipped = true;
  if (ctx.options.superAdminEmail) {
    const superAdminLogin = await loginWithDevCode(ctx, ctx.options.superAdminEmail);
    const paidEventResponse = await ctx.request({
      method: 'POST',
      path: '/payments/referral-events/paid',
      token: superAdminLogin.token,
      json: {
        userId: invitee.userId,
        tenantId: invitee.tenantId,
        provider: 'wechat',
        orderId: uniqueSuffix('ref-paid-order'),
        paymentId: uniqueSuffix('ref-paid-payment'),
        paidAt: new Date().toISOString(),
      },
    });
    if (paidEventResponse.status === 201) {
      const paidEvent = settleReferralPaidEventResponseSchema.parse(paidEventResponse.body);
      if (paidEvent.settled) {
        throw new ApiTestError('referrals.paid-event expected settled=false under first_product_create mode');
      }
      paidEventSkipped = false;
      checks += 1;
    }
  }

  return {
    checks,
    details: {
      inviterUserId: inviter.userId,
      inviteeUserId: invitee.userId,
      inviterReferralCode: inviterOverview.referralCode,
      paidEventSkipped,
    },
  };
}

async function registerFreshUser(ctx: TestContext, prefix: string): Promise<RegisteredUser> {
  const phoneNumber = nextPhoneNumber();
  const account = nextAccount(prefix);
  const password = `Referral@${Date.now()}!`;
  const { devCode } = await requestSmsCode(ctx, phoneNumber, 'register');

  const registerResponse = await ctx.request({
    method: 'POST',
    path: '/auth/register',
    json: {
      account,
      phoneNumber,
      code: devCode,
      password,
    },
  });
  assertStatus(registerResponse, 201, `auth.register.${prefix}`);

  const payload = registerResponseSchema.parse(registerResponse.body);
  return {
    token: payload.accessToken,
    userId: payload.user.id,
    tenantId: payload.tenant.id,
    tenantSlug: payload.tenant.slug,
  };
}

async function getReferralOverview(ctx: TestContext, token: string, label: string) {
  const response = await ctx.request({
    method: 'GET',
    path: '/me/referral',
    token,
  });
  assertStatus(response, 200, label);
  return myReferralOverviewResponseSchema.parse(response.body);
}

async function getMySubscription(ctx: TestContext, token: string, label: string) {
  const response = await ctx.request({
    method: 'GET',
    path: '/me/subscription',
    token,
  });
  assertStatus(response, 200, label);
  return meSubscriptionResponseSchema.parse(response.body);
}

function requireExpiresAtMs(expiresAt: string | null, label: string): number {
  if (!expiresAt) {
    throw new ApiTestError(`${label} expected expiresAt to be present`);
  }

  const value = Date.parse(expiresAt);
  if (Number.isNaN(value)) {
    throw new ApiTestError(`${label} expected valid expiresAt, got ${expiresAt}`);
  }

  return value;
}

function nextAccount(prefix: string): string {
  accountCounter += 1;
  const suffix = `${Date.now().toString(36)}${accountCounter.toString(36)}`.replace(/[^a-z0-9]/g, '');
  return `${prefix}${suffix}`.slice(0, 24);
}

function nextPhoneNumber(): string {
  phoneCounter += 1;
  const seed = `${Date.now()}${phoneCounter}`.replace(/\D/g, '');
  return `1${seed.slice(-10).padStart(10, '0')}`;
}
