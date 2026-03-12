import { z } from 'zod';

import {
  payableTenantSubscriptionPlanSchema,
  subscriptionDurationDaysSchema,
} from './subscription-catalog';

export const subscriptionOrderStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'CANCELLED',
  'REFUNDED',
  'EXPIRED',
]);
export const subscriptionOrderPaymentProviderSchema = z.enum(['WECHAT', 'ALIPAY']);
export const subscriptionOrderPaymentChannelSchema = z.enum(['JSAPI', 'H5']);
export const subscriptionOrderFulfillmentModeSchema = z.enum(['IMMEDIATE', 'DEFERRED']);

export const subscriptionOrderWechatJsapiParamsSchema = z.object({
  appId: z.string().min(1),
  timeStamp: z.string().min(1),
  nonceStr: z.string().min(1),
  package: z.string().min(1),
  signType: z.literal('RSA'),
  paySign: z.string().min(1),
});

export const subscriptionOrderSchema = z.object({
  orderId: z.string().min(1),
  orderNo: z.string().min(1),
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  plan: payableTenantSubscriptionPlanSchema,
  durationDays: subscriptionDurationDaysSchema,
  totalAmountCents: z.number().int().positive(),
  currency: z.string().trim().length(3),
  paymentProvider: subscriptionOrderPaymentProviderSchema,
  paymentChannel: subscriptionOrderPaymentChannelSchema,
  paymentId: z.string().min(1).nullable(),
  paymentPrepayId: z.string().min(1).nullable(),
  status: subscriptionOrderStatusSchema,
  statusReason: z.string().nullable(),
  fulfillmentMode: subscriptionOrderFulfillmentModeSchema,
  effectiveStartsAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  paidAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
  appliedAt: z.string().datetime().nullable(),
});

export const createSubscriptionOrderRequestSchema = z.object({
  plan: payableTenantSubscriptionPlanSchema,
  durationDays: subscriptionDurationDaysSchema,
  paymentChannel: subscriptionOrderPaymentChannelSchema.default('JSAPI'),
});

export const createSubscriptionOrderResponseSchema = z.object({
  order: subscriptionOrderSchema,
  jsapiParams: subscriptionOrderWechatJsapiParamsSchema,
});

export const getSubscriptionOrderResponseSchema = z.object({
  order: subscriptionOrderSchema,
});

export const cancelSubscriptionOrderResponseSchema = z.object({
  order: subscriptionOrderSchema,
});

export type SubscriptionOrderStatus = z.infer<typeof subscriptionOrderStatusSchema>;
export type SubscriptionOrderPaymentProvider = z.infer<
  typeof subscriptionOrderPaymentProviderSchema
>;
export type SubscriptionOrderPaymentChannel = z.infer<
  typeof subscriptionOrderPaymentChannelSchema
>;
export type SubscriptionOrderFulfillmentMode = z.infer<
  typeof subscriptionOrderFulfillmentModeSchema
>;
export type SubscriptionOrderWechatJsapiParams = z.infer<
  typeof subscriptionOrderWechatJsapiParamsSchema
>;
export type SubscriptionOrder = z.infer<typeof subscriptionOrderSchema>;
export type CreateSubscriptionOrderRequest = z.infer<typeof createSubscriptionOrderRequestSchema>;
export type CreateSubscriptionOrderResponse = z.infer<
  typeof createSubscriptionOrderResponseSchema
>;
export type GetSubscriptionOrderResponse = z.infer<typeof getSubscriptionOrderResponseSchema>;
export type CancelSubscriptionOrderResponse = z.infer<
  typeof cancelSubscriptionOrderResponseSchema
>;
