import { z } from 'zod';

const maxStorageBytesInputSchema = z
  .union([z.string().trim().regex(/^\d+$/), z.number().int().min(0)])
  .transform((value) => (typeof value === 'number' ? String(value) : value));
const activationCodeInputSchema = z.string().trim().min(8).max(80);

export const tenantSubscriptionPlanSchema = z.enum(['FREE', 'BASIC', 'PRO']);
export const tenantSubscriptionStatusSchema = z.enum(['ACTIVE', 'DISABLED', 'EXPIRED']);

export const tenantSubscriptionSchema = z.object({
  tenantId: z.string().min(1),
  isConfigured: z.boolean(),
  plan: tenantSubscriptionPlanSchema,
  status: tenantSubscriptionStatusSchema,
  startsAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  disabledAt: z.string().datetime().nullable(),
  disabledReason: z.string().nullable(),
  maxImages: z.number().int().min(0).nullable(),
  maxStorageBytes: z.string().regex(/^\d+$/).nullable(),
  maxShares: z.number().int().min(0).nullable(),
  createdAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable()
});

export const updateTenantSubscriptionRequestSchema = z
  .object({
    plan: tenantSubscriptionPlanSchema.optional(),
    startsAt: z.string().datetime().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    disabledAt: z.string().datetime().nullable().optional(),
    disabledReason: z.string().trim().max(255).nullable().optional(),
    maxImages: z.number().int().min(0).nullable().optional(),
    maxStorageBytes: maxStorageBytesInputSchema.nullable().optional(),
    maxShares: z.number().int().min(0).nullable().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field must be provided to update subscription.'
  });

export const getAdminTenantSubscriptionResponseSchema = z.object({
  subscription: tenantSubscriptionSchema
});

export const updateTenantSubscriptionResponseSchema = z.object({
  subscription: tenantSubscriptionSchema,
  auditLogId: z.string().min(1)
});

export const tenantSubscriptionActivationCodeSchema = z.object({
  id: z.string().min(1),
  codeLabel: z.string().min(1).max(32),
  targetTenantId: z.string().min(1).nullable(),
  plan: tenantSubscriptionPlanSchema,
  durationDays: z.number().int().min(1).nullable(),
  maxImages: z.number().int().min(0).nullable(),
  maxStorageBytes: z.string().regex(/^\d+$/).nullable(),
  maxShares: z.number().int().min(0).nullable(),
  redeemLimit: z.number().int().min(1),
  redeemedCount: z.number().int().min(0),
  expiresAt: z.string().datetime().nullable(),
  disabledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime()
});

export const createTenantSubscriptionActivationCodeRequestSchema = z.object({
  targetTenantId: z.string().trim().min(1).nullable().optional(),
  plan: tenantSubscriptionPlanSchema.default('PRO'),
  durationDays: z.number().int().min(1).max(3650).nullable().optional(),
  maxImages: z.number().int().min(0).nullable().optional(),
  maxStorageBytes: maxStorageBytesInputSchema.nullable().optional(),
  maxShares: z.number().int().min(0).nullable().optional(),
  redeemLimit: z.number().int().min(1).max(1000).optional(),
  expiresAt: z.string().datetime().nullable().optional()
});

export const createTenantSubscriptionActivationCodeResponseSchema = z.object({
  activationCode: tenantSubscriptionActivationCodeSchema.extend({
    code: z.string().min(8).max(80)
  }),
  auditLogId: z.string().min(1)
});

export const redeemTenantSubscriptionActivationCodeRequestSchema = z.object({
  code: activationCodeInputSchema
});

export const redeemTenantSubscriptionActivationCodeResponseSchema = z.object({
  subscription: tenantSubscriptionSchema,
  activationCode: tenantSubscriptionActivationCodeSchema.pick({
    id: true,
    codeLabel: true,
    redeemLimit: true,
    redeemedCount: true
  }),
  redeemedAt: z.string().datetime()
});

export type TenantSubscriptionPlan = z.infer<typeof tenantSubscriptionPlanSchema>;
export type TenantSubscriptionStatus = z.infer<typeof tenantSubscriptionStatusSchema>;
export type TenantSubscription = z.infer<typeof tenantSubscriptionSchema>;
export type UpdateTenantSubscriptionRequest = z.infer<typeof updateTenantSubscriptionRequestSchema>;
export type GetAdminTenantSubscriptionResponse = z.infer<typeof getAdminTenantSubscriptionResponseSchema>;
export type UpdateTenantSubscriptionResponse = z.infer<typeof updateTenantSubscriptionResponseSchema>;
export type TenantSubscriptionActivationCode = z.infer<typeof tenantSubscriptionActivationCodeSchema>;
export type CreateTenantSubscriptionActivationCodeRequest = z.infer<
  typeof createTenantSubscriptionActivationCodeRequestSchema
>;
export type CreateTenantSubscriptionActivationCodeResponse = z.infer<
  typeof createTenantSubscriptionActivationCodeResponseSchema
>;
export type RedeemTenantSubscriptionActivationCodeRequest = z.infer<
  typeof redeemTenantSubscriptionActivationCodeRequestSchema
>;
export type RedeemTenantSubscriptionActivationCodeResponse = z.infer<
  typeof redeemTenantSubscriptionActivationCodeResponseSchema
>;
