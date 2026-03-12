import { z } from 'zod';

export const referralBindingSourceSchema = z.enum(['share_link', 'manual_fallback', 'public_page_auto']);
export const referralRewardModeSchema = z.enum(['first_product_create', 'paid_order']);
export const referralRewardTriggerTypeSchema = z.enum(['first_payment', 'renewal', 'first_product_create']);
export const referralRewardStatusSchema = z.enum(['PENDING', 'AWARDED', 'SKIPPED']);
export const referralAttributionPageTypeSchema = z.enum([
  'share_feed',
  'share_product',
  'tenant_feed',
  'tenant_product',
  'certificate_verify',
]);

export const referralProgramRulesSchema = z.object({
  rewardMode: referralRewardModeSchema,
  firstPaymentReferrerDays: z.number().int().min(0),
  firstPaymentInviteeDays: z.number().int().min(0),
  firstProductReferrerDays: z.number().int().min(0),
  firstProductInviteeDays: z.number().int().min(0),
  renewalReferrerDays: z.number().int().min(0),
  monthlyCapDays: z.number().int().positive(),
  bindWindowHours: z.number().int().positive(),
  attributionTtlDays: z.number().int().positive(),
  autoBindPublicEnabled: z.boolean(),
});

export const referralBindingSchema = z.object({
  id: z.string().min(1),
  referrerUserId: z.string().min(1),
  inviteeUserId: z.string().min(1),
  referralCode: z.string().min(1),
  source: referralBindingSourceSchema,
  boundAt: z.string().datetime(),
});

export const referralRewardSchema = z.object({
  id: z.string().min(1),
  status: referralRewardStatusSchema,
  triggerType: referralRewardTriggerTypeSchema,
  statusReason: z.string().nullable(),
  referrerUserId: z.string().min(1),
  inviteeUserId: z.string().min(1),
  paymentProvider: z.string().nullable(),
  paymentId: z.string().nullable(),
  orderId: z.string().nullable(),
  rewardDaysReferrer: z.number().int().min(0),
  rewardDaysInvitee: z.number().int().min(0),
  awardedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const referralInviteProgressStatusSchema = z.enum([
  'bound',
  'first_product_uploaded',
  'reward_awarded',
  'reward_skipped',
]);

export const referralInviteProgressSchema = z.object({
  inviteeUserId: z.string().min(1),
  inviteeDisplayName: z.string().min(1),
  referralCode: z.string().min(1),
  boundAt: z.string().datetime(),
  firstProductCreatedAt: z.string().datetime().nullable(),
  rewardStatus: referralRewardStatusSchema.nullable(),
  rewardAwardedAt: z.string().datetime().nullable(),
  status: referralInviteProgressStatusSchema,
});

export const myReferralOverviewResponseSchema = z.object({
  referralCode: z.string().min(1),
  sharePath: z.string().min(1),
  shareUrl: z.string().min(1),
  rules: referralProgramRulesSchema,
  binding: referralBindingSchema.nullable(),
  invitedCount: z.number().int().min(0),
  activatedInviteeCount: z.number().int().min(0),
  totalAwardedDays: z.number().int().min(0),
  monthAwardedDays: z.number().int().min(0),
  monthRemainingDays: z.number().int().min(0),
  invites: z.array(referralInviteProgressSchema),
  rewards: z.array(referralRewardSchema),
});

export const bindReferralRequestSchema = z.object({
  referralCode: z.string().trim().min(6).max(32),
  source: referralBindingSourceSchema.optional(),
});

export const bindReferralResponseSchema = z.object({
  binding: referralBindingSchema,
});

export const bindReferralFromAttributionRequestSchema = z.object({
  fromUrl: z.string().trim().min(1).max(2000),
  pageType: referralAttributionPageTypeSchema,
  shareToken: z.string().trim().min(1).max(120).nullable().optional(),
  tenantSlug: z.string().trim().min(1).max(120).nullable().optional(),
  productId: z.string().trim().min(1).max(120).nullable().optional(),
  verifyId: z.string().trim().min(1).max(120).nullable().optional(),
  entrySource: z.string().trim().min(1).max(40).nullable().optional(),
  capturedAt: z.string().datetime().optional(),
});

export const bindReferralFromAttributionResponseSchema = z.object({
  consumed: z.boolean(),
  binding: referralBindingSchema.nullable(),
  inviter: z
    .object({
      userId: z.string().min(1),
      displayName: z.string().min(1),
      tenantName: z.string().min(1).nullable(),
    })
    .nullable(),
  reason: z.string().nullable(),
});

export const publicReferralLandingResponseSchema = z.object({
  referralCode: z.string().min(1),
  inviter: z.object({
    userId: z.string().min(1),
    displayName: z.string().min(1),
    tenantName: z.string().min(1).nullable(),
  }),
  sharePath: z.string().min(1),
  shareUrl: z.string().min(1),
  rules: referralProgramRulesSchema,
});

export const settleReferralPaidEventRequestSchema = z.object({
  userId: z.string().trim().min(1),
  tenantId: z.string().trim().min(1),
  provider: z.string().trim().min(1).max(32),
  orderId: z.string().trim().min(1).max(80),
  paymentId: z.string().trim().min(1).max(80).nullable().optional(),
  paidAt: z.string().datetime().optional(),
});

export const settleReferralPaidEventResponseSchema = z.object({
  settled: z.boolean(),
  triggerType: referralRewardTriggerTypeSchema.nullable(),
  reward: referralRewardSchema.nullable(),
});

export type ReferralBindingSource = z.infer<typeof referralBindingSourceSchema>;
export type ReferralRewardMode = z.infer<typeof referralRewardModeSchema>;
export type ReferralRewardTriggerType = z.infer<typeof referralRewardTriggerTypeSchema>;
export type ReferralRewardStatus = z.infer<typeof referralRewardStatusSchema>;
export type ReferralAttributionPageType = z.infer<typeof referralAttributionPageTypeSchema>;
export type ReferralProgramRules = z.infer<typeof referralProgramRulesSchema>;
export type ReferralBinding = z.infer<typeof referralBindingSchema>;
export type ReferralReward = z.infer<typeof referralRewardSchema>;
export type ReferralInviteProgress = z.infer<typeof referralInviteProgressSchema>;
export type MyReferralOverviewResponse = z.infer<typeof myReferralOverviewResponseSchema>;
export type BindReferralRequest = z.infer<typeof bindReferralRequestSchema>;
export type BindReferralResponse = z.infer<typeof bindReferralResponseSchema>;
export type BindReferralFromAttributionRequest = z.infer<typeof bindReferralFromAttributionRequestSchema>;
export type BindReferralFromAttributionResponse = z.infer<typeof bindReferralFromAttributionResponseSchema>;
export type PublicReferralLandingResponse = z.infer<typeof publicReferralLandingResponseSchema>;
export type SettleReferralPaidEventRequest = z.infer<typeof settleReferralPaidEventRequestSchema>;
export type SettleReferralPaidEventResponse = z.infer<typeof settleReferralPaidEventResponseSchema>;
