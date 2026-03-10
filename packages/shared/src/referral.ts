import { z } from 'zod';

export const referralBindingSourceSchema = z.enum(['share_link', 'manual_fallback']);
export const referralRewardTriggerTypeSchema = z.enum(['first_payment', 'renewal']);
export const referralRewardStatusSchema = z.enum(['PENDING', 'AWARDED', 'SKIPPED']);

export const referralProgramRulesSchema = z.object({
  firstPaymentReferrerDays: z.number().int().min(0),
  firstPaymentInviteeDays: z.number().int().min(0),
  renewalReferrerDays: z.number().int().min(0),
  monthlyCapDays: z.number().int().positive(),
  bindWindowHours: z.number().int().positive(),
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
  rewards: z.array(referralRewardSchema),
});

export const bindReferralRequestSchema = z.object({
  referralCode: z.string().trim().min(6).max(32),
  source: referralBindingSourceSchema.optional(),
});

export const bindReferralResponseSchema = z.object({
  binding: referralBindingSchema,
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
export type ReferralRewardTriggerType = z.infer<typeof referralRewardTriggerTypeSchema>;
export type ReferralRewardStatus = z.infer<typeof referralRewardStatusSchema>;
export type ReferralProgramRules = z.infer<typeof referralProgramRulesSchema>;
export type ReferralBinding = z.infer<typeof referralBindingSchema>;
export type ReferralReward = z.infer<typeof referralRewardSchema>;
export type MyReferralOverviewResponse = z.infer<typeof myReferralOverviewResponseSchema>;
export type BindReferralRequest = z.infer<typeof bindReferralRequestSchema>;
export type BindReferralResponse = z.infer<typeof bindReferralResponseSchema>;
export type PublicReferralLandingResponse = z.infer<typeof publicReferralLandingResponseSchema>;
export type SettleReferralPaidEventRequest = z.infer<typeof settleReferralPaidEventRequestSchema>;
export type SettleReferralPaidEventResponse = z.infer<typeof settleReferralPaidEventResponseSchema>;
