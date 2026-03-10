import { meSubscriptionResponseSchema, registerResponseSchema } from '../../packages/shared/src/auth';
import {
  bindReferralResponseSchema,
  myReferralOverviewResponseSchema,
  publicReferralLandingResponseSchema,
  settleReferralPaidEventResponseSchema,
} from '../../packages/shared/src/referral';
import { createProductResponseSchema } from '../../packages/shared/src/product';
import { updateTenantSubscriptionResponseSchema } from '../../packages/shared/src/subscription';

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
  referralCode?: string;
};

let accountCounter = 0;
let phoneCounter = 0;

export const referralsModule: TestModule = {
  name: 'referrals',
  description:
    'Referral binding, activation counting, reward settlement, monthly cap clipping, and paid-account bind guard checks',
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
  if (inviterOverview.activatedInviteeCount !== 0 || inviterOverview.monthAwardedDays !== 0) {
    throw new ApiTestError('referrals.inviter.overview-initial expected zero activation and reward counters');
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

  const bindResponse = await ctx.request({
    method: 'POST',
    path: '/referrals/bind',
    token: invitee.token,
    json: {
      referralCode: inviterOverview.referralCode,
      source: 'share_link',
    },
  });
  assertStatus(bindResponse, 201, 'referrals.bind');
  const binding = bindReferralResponseSchema.parse(bindResponse.body).binding;
  if (binding.referrerUserId !== inviter.userId || binding.inviteeUserId !== invitee.userId) {
    throw new ApiTestError('referrals.bind relation mismatch');
  }
  checks += 1;

  const bindReplayResponse = await ctx.request({
    method: 'POST',
    path: '/referrals/bind',
    token: invitee.token,
    json: {
      referralCode: inviterOverview.referralCode,
      source: 'share_link',
    },
  });
  assertStatus(bindReplayResponse, 201, 'referrals.bind-replay');
  const replayBinding = bindReferralResponseSchema.parse(bindReplayResponse.body).binding;
  if (replayBinding.id !== binding.id) {
    throw new ApiTestError('referrals.bind-replay expected idempotent binding id');
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

  const inviteeProductResponse = await ctx.request({
    method: 'POST',
    path: '/products',
    token: invitee.token,
    json: {
      code: uniqueSuffix('ref').replace(/-/g, '').slice(0, 18).toUpperCase(),
      name: `Referral Activation ${Date.now()}`,
      description: 'Referral activation fixture',
    },
  });
  assertStatus(inviteeProductResponse, 201, 'referrals.invitee.product-create');
  createProductResponseSchema.parse(inviteeProductResponse.body);
  checks += 1;

  const inviterAfterActivation = await getReferralOverview(
    ctx,
    inviter.token,
    'referrals.inviter.overview-after-activation',
  );
  checks += 1;
  if (inviterAfterActivation.activatedInviteeCount !== 1) {
    throw new ApiTestError('referrals.inviter.overview-after-activation expected activatedInviteeCount=1');
  }

  if (!ctx.options.superAdminEmail) {
    ctx.log.warn('referrals.settlement.skipped', {
      reason: 'missing --super-admin-email for internal settlement and paid-account bind guard checks',
    });

    return {
      checks,
      details: {
        inviterUserId: inviter.userId,
        inviteeUserId: invitee.userId,
        inviterReferralCode: inviterOverview.referralCode,
        settlementSkipped: true,
        paidBindGuardSkipped: true,
      },
    };
  }

  const superAdminLogin = await loginWithDevCode(ctx, ctx.options.superAdminEmail);

  const inviterSubscriptionBefore = await getMySubscription(
    ctx,
    inviter.token,
    'referrals.inviter.subscription-before',
  );
  checks += 1;
  const inviteeSubscriptionBefore = await getMySubscription(
    ctx,
    invitee.token,
    'referrals.invitee.subscription-before',
  );
  checks += 1;
  if (inviterSubscriptionBefore.subscription.plan !== 'FREE') {
    throw new ApiTestError('referrals.inviter.subscription-before expected FREE plan');
  }
  if (inviteeSubscriptionBefore.subscription.plan !== 'FREE') {
    throw new ApiTestError('referrals.invitee.subscription-before expected FREE plan');
  }

  const firstPaymentOrderId = uniqueSuffix('ref-first-order');
  const firstPaymentResponse = await ctx.request({
    method: 'POST',
    path: '/payments/referral-events/paid',
    token: superAdminLogin.token,
    json: {
      userId: invitee.userId,
      tenantId: invitee.tenantId,
      provider: 'wechat',
      orderId: firstPaymentOrderId,
      paymentId: uniqueSuffix('ref-first-pay'),
      paidAt: new Date().toISOString(),
    },
  });
  checks += 1;

  if (firstPaymentResponse.status !== 201) {
    if (ctx.options.requireSuperAdminPass) {
      throw new ApiTestError(
        `referrals.first-payment expected 201, got ${firstPaymentResponse.status}`,
      );
    }

    ctx.log.warn('referrals.super-admin.warn', {
      status: firstPaymentResponse.status,
      hint: 'Mark the settlement operator as isSuperAdmin=true for full referral settlement checks.',
    });

    return {
      checks,
      details: {
        inviterUserId: inviter.userId,
        inviteeUserId: invitee.userId,
        inviterReferralCode: inviterOverview.referralCode,
        settlementSkipped: true,
        paidBindGuardSkipped: true,
        superAdminStatus: firstPaymentResponse.status,
      },
    };
  }

  const firstPayment = settleReferralPaidEventResponseSchema.parse(firstPaymentResponse.body);
  if (!firstPayment.settled || firstPayment.triggerType !== 'first_payment' || !firstPayment.reward) {
    throw new ApiTestError('referrals.first-payment expected settled first_payment reward');
  }
  if (firstPayment.reward.rewardDaysReferrer !== 7 || firstPayment.reward.rewardDaysInvitee !== 7) {
    throw new ApiTestError('referrals.first-payment expected inviter/invitee reward days = 7/7');
  }

  const firstPaymentReplayResponse = await ctx.request({
    method: 'POST',
    path: '/payments/referral-events/paid',
    token: superAdminLogin.token,
    json: {
      userId: invitee.userId,
      tenantId: invitee.tenantId,
      provider: 'wechat',
      orderId: firstPaymentOrderId,
      paymentId: firstPayment.reward.paymentId,
      paidAt: new Date(Date.now() + 10_000).toISOString(),
    },
  });
  assertStatus(firstPaymentReplayResponse, 201, 'referrals.first-payment-replay');
  const firstPaymentReplay = settleReferralPaidEventResponseSchema.parse(firstPaymentReplayResponse.body);
  if (firstPaymentReplay.reward?.id !== firstPayment.reward.id) {
    throw new ApiTestError('referrals.first-payment-replay expected same reward id');
  }
  checks += 1;

  const inviterSubscriptionAfterFirst = await getMySubscription(
    ctx,
    inviter.token,
    'referrals.inviter.subscription-after-first',
  );
  const inviteeSubscriptionAfterFirst = await getMySubscription(
    ctx,
    invitee.token,
    'referrals.invitee.subscription-after-first',
  );
  checks += 2;
  const inviterExpiryAfterFirst = requireExpiresAtMs(
    inviterSubscriptionAfterFirst.subscription.expiresAt,
    'referrals.inviter.subscription-after-first',
  );
  const inviteeExpiryAfterFirst = requireExpiresAtMs(
    inviteeSubscriptionAfterFirst.subscription.expiresAt,
    'referrals.invitee.subscription-after-first',
  );

  const inviterAfterFirst = await getReferralOverview(
    ctx,
    inviter.token,
    'referrals.inviter.overview-after-first',
  );
  const inviteeAfterFirst = await getReferralOverview(
    ctx,
    invitee.token,
    'referrals.invitee.overview-after-first',
  );
  checks += 2;
  assertMonthCounters(inviterAfterFirst, 7, 53, 'referrals.inviter.overview-after-first');
  assertMonthCounters(inviteeAfterFirst, 7, 53, 'referrals.invitee.overview-after-first');

  const renewalOne = await settlePaidOrder(ctx, superAdminLogin.token, {
    userId: invitee.userId,
    tenantId: invitee.tenantId,
    provider: 'wechat',
    orderId: uniqueSuffix('ref-renew-1'),
    paymentId: uniqueSuffix('ref-renew-pay-1'),
  }, 'referrals.renewal-1');
  checks += 1;
  if (!renewalOne.reward || renewalOne.triggerType !== 'renewal') {
    throw new ApiTestError('referrals.renewal-1 expected renewal reward');
  }
  if (renewalOne.reward.rewardDaysReferrer !== 30 || renewalOne.reward.rewardDaysInvitee !== 0) {
    throw new ApiTestError('referrals.renewal-1 expected inviter/invitee reward days = 30/0');
  }

  const inviterSubscriptionAfterRenewalOne = await getMySubscription(
    ctx,
    inviter.token,
    'referrals.inviter.subscription-after-renewal-1',
  );
  const inviteeSubscriptionAfterRenewalOne = await getMySubscription(
    ctx,
    invitee.token,
    'referrals.invitee.subscription-after-renewal-1',
  );
  checks += 2;
  const inviterExpiryAfterRenewalOne = requireExpiresAtMs(
    inviterSubscriptionAfterRenewalOne.subscription.expiresAt,
    'referrals.inviter.subscription-after-renewal-1',
  );
  const inviteeExpiryAfterRenewalOne = requireExpiresAtMs(
    inviteeSubscriptionAfterRenewalOne.subscription.expiresAt,
    'referrals.invitee.subscription-after-renewal-1',
  );
  if (inviterExpiryAfterRenewalOne <= inviterExpiryAfterFirst) {
    throw new ApiTestError('referrals.inviter.subscription-after-renewal-1 expected later expiry');
  }
  if (inviteeExpiryAfterRenewalOne !== inviteeExpiryAfterFirst) {
    throw new ApiTestError('referrals.invitee.subscription-after-renewal-1 expected unchanged expiry');
  }

  const inviterAfterRenewalOne = await getReferralOverview(
    ctx,
    inviter.token,
    'referrals.inviter.overview-after-renewal-1',
  );
  checks += 1;
  assertMonthCounters(inviterAfterRenewalOne, 37, 23, 'referrals.inviter.overview-after-renewal-1');

  const renewalTwo = await settlePaidOrder(ctx, superAdminLogin.token, {
    userId: invitee.userId,
    tenantId: invitee.tenantId,
    provider: 'wechat',
    orderId: uniqueSuffix('ref-renew-2'),
    paymentId: uniqueSuffix('ref-renew-pay-2'),
  }, 'referrals.renewal-2');
  checks += 1;
  if (!renewalTwo.reward || renewalTwo.reward.rewardDaysReferrer !== 23) {
    throw new ApiTestError('referrals.renewal-2 expected clipped inviter reward of 23 days');
  }
  if (renewalTwo.reward.statusReason !== 'monthly_cap_clipped') {
    throw new ApiTestError('referrals.renewal-2 expected monthly_cap_clipped statusReason');
  }

  const renewalThree = await settlePaidOrder(ctx, superAdminLogin.token, {
    userId: invitee.userId,
    tenantId: invitee.tenantId,
    provider: 'wechat',
    orderId: uniqueSuffix('ref-renew-3'),
    paymentId: uniqueSuffix('ref-renew-pay-3'),
  }, 'referrals.renewal-3');
  checks += 1;
  if (!renewalThree.reward || renewalThree.reward.rewardDaysReferrer !== 0) {
    throw new ApiTestError('referrals.renewal-3 expected zero inviter reward after monthly cap');
  }
  if (renewalThree.reward.status !== 'SKIPPED' || renewalThree.reward.statusReason !== 'monthly_cap_reached') {
    throw new ApiTestError('referrals.renewal-3 expected skipped reward after monthly cap');
  }

  const inviterSubscriptionAfterRenewalTwo = await getMySubscription(
    ctx,
    inviter.token,
    'referrals.inviter.subscription-after-renewal-2',
  );
  const inviterSubscriptionAfterRenewalThree = await getMySubscription(
    ctx,
    inviter.token,
    'referrals.inviter.subscription-after-renewal-3',
  );
  checks += 2;
  const inviterExpiryAfterRenewalTwo = requireExpiresAtMs(
    inviterSubscriptionAfterRenewalTwo.subscription.expiresAt,
    'referrals.inviter.subscription-after-renewal-2',
  );
  const inviterExpiryAfterRenewalThree = requireExpiresAtMs(
    inviterSubscriptionAfterRenewalThree.subscription.expiresAt,
    'referrals.inviter.subscription-after-renewal-3',
  );
  if (inviterExpiryAfterRenewalTwo <= inviterExpiryAfterRenewalOne) {
    throw new ApiTestError('referrals.inviter.subscription-after-renewal-2 expected later expiry');
  }
  if (inviterExpiryAfterRenewalThree !== inviterExpiryAfterRenewalTwo) {
    throw new ApiTestError('referrals.inviter.subscription-after-renewal-3 expected unchanged expiry');
  }

  const inviterAtCap = await getReferralOverview(ctx, inviter.token, 'referrals.inviter.overview-cap');
  checks += 1;
  assertMonthCounters(inviterAtCap, 60, 0, 'referrals.inviter.overview-cap');

  const paidCandidate = await registerFreshUser(ctx, 'refpaid');
  checks += 1;
  const paidCandidateSetProResponse = await ctx.request({
    method: 'PUT',
    path: `/admin/tenants/${paidCandidate.tenantId}/subscription`,
    token: superAdminLogin.token,
    json: {
      plan: 'PRO',
      startsAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      disabledAt: null,
      disabledReason: null,
      maxImages: null,
      maxStorageBytes: null,
      maxShares: null,
    },
  });
  assertStatus(paidCandidateSetProResponse, 200, 'referrals.paid-candidate.set-pro');
  updateTenantSubscriptionResponseSchema.parse(paidCandidateSetProResponse.body);
  checks += 1;

  const paidCandidateBindResponse = await ctx.request({
    method: 'POST',
    path: '/referrals/bind',
    token: paidCandidate.token,
    json: {
      referralCode: inviterOverview.referralCode,
      source: 'manual_fallback',
    },
  });
  assertStatus(paidCandidateBindResponse, 403, 'referrals.paid-candidate.bind-denied');
  assertErrorCode(paidCandidateBindResponse, 'FORBIDDEN');
  checks += 1;

  ctx.log.ok('referrals.done', {
    checks,
    inviterUserId: inviter.userId,
    inviteeUserId: invitee.userId,
    inviterReferralCode: inviterOverview.referralCode,
  });

  return {
    checks,
    details: {
      inviterUserId: inviter.userId,
      inviteeUserId: invitee.userId,
      inviterReferralCode: inviterOverview.referralCode,
      settlementSkipped: false,
      paidBindGuardSkipped: false,
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

async function settlePaidOrder(
  ctx: TestContext,
  superAdminToken: string,
  payload: {
    userId: string;
    tenantId: string;
    provider: string;
    orderId: string;
    paymentId: string;
  },
  label: string,
) {
  const response = await ctx.request({
    method: 'POST',
    path: '/payments/referral-events/paid',
    token: superAdminToken,
    json: {
      ...payload,
      paidAt: new Date().toISOString(),
    },
  });
  assertStatus(response, 201, label);
  return settleReferralPaidEventResponseSchema.parse(response.body);
}

function assertMonthCounters(
  overview: ReturnType<typeof myReferralOverviewResponseSchema.parse>,
  expectedAwarded: number,
  expectedRemaining: number,
  label: string,
) {
  if (overview.monthAwardedDays !== expectedAwarded || overview.monthRemainingDays !== expectedRemaining) {
    throw new ApiTestError(
      `${label} expected monthAwardedDays/monthRemainingDays = ${expectedAwarded}/${expectedRemaining}, got ${overview.monthAwardedDays}/${overview.monthRemainingDays}`,
    );
  }
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
