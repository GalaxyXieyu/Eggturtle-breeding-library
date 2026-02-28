import { z } from 'zod';

const maxStorageBytesInputSchema = z
  .union([z.string().trim().regex(/^\d+$/), z.number().int().min(0)])
  .transform((value) => (typeof value === 'number' ? String(value) : value));

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

export type TenantSubscriptionPlan = z.infer<typeof tenantSubscriptionPlanSchema>;
export type TenantSubscriptionStatus = z.infer<typeof tenantSubscriptionStatusSchema>;
export type TenantSubscription = z.infer<typeof tenantSubscriptionSchema>;
export type UpdateTenantSubscriptionRequest = z.infer<typeof updateTenantSubscriptionRequestSchema>;
export type GetAdminTenantSubscriptionResponse = z.infer<typeof getAdminTenantSubscriptionResponseSchema>;
export type UpdateTenantSubscriptionResponse = z.infer<typeof updateTenantSubscriptionResponseSchema>;
