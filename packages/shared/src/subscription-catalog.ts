import { z } from 'zod';

import { tenantSubscriptionPlanSchema } from './subscription';

export const payableTenantSubscriptionPlanSchema = z.enum(['BASIC', 'PRO']);
export const subscriptionDurationDaysSchema = z.union([
  z.literal(30),
  z.literal(90),
  z.literal(365),
]);

export const SUBSCRIPTION_PLAN_PRODUCT_LIMITS = {
  FREE: 10,
  BASIC: 30,
  PRO: 200,
} as const satisfies Record<z.infer<typeof tenantSubscriptionPlanSchema>, number>;

export const SUBSCRIPTION_PLAN_MONTHLY_PRICE_CENTS = {
  FREE: 0,
  BASIC: 2800,
  PRO: 4900,
} as const satisfies Record<z.infer<typeof tenantSubscriptionPlanSchema>, number>;

export const SUBSCRIPTION_PRICE_BOOK = {
  BASIC: {
    30: 2800,
    90: 7900,
    365: 29900,
  },
  PRO: {
    30: 4900,
    90: 12900,
    365: 49900,
  },
} as const satisfies Record<
  z.infer<typeof payableTenantSubscriptionPlanSchema>,
  Record<z.infer<typeof subscriptionDurationDaysSchema>, number>
>;

export function isPayableTenantSubscriptionPlan(
  plan: z.infer<typeof tenantSubscriptionPlanSchema>,
): plan is z.infer<typeof payableTenantSubscriptionPlanSchema> {
  return plan === 'BASIC' || plan === 'PRO';
}

export function resolveSubscriptionPriceCents(
  plan: z.infer<typeof payableTenantSubscriptionPlanSchema>,
  durationDays: z.infer<typeof subscriptionDurationDaysSchema>,
): number {
  return SUBSCRIPTION_PRICE_BOOK[plan][durationDays];
}

export type PayableTenantSubscriptionPlan = z.infer<typeof payableTenantSubscriptionPlanSchema>;
export type SubscriptionDurationDays = z.infer<typeof subscriptionDurationDaysSchema>;
