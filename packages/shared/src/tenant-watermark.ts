import { z } from 'zod';

import { tenantSubscriptionPlanSchema, tenantSubscriptionStatusSchema } from './subscription';

export const tenantWatermarkTextModeSchema = z.enum(['AUTO_TENANT_NAME', 'CUSTOM']);
export const TENANT_WATERMARK_MAX_TEXT_LENGTH = 64;

const nullableCustomTextSchema = z
  .string()
  .trim()
  .max(TENANT_WATERMARK_MAX_TEXT_LENGTH)
  .nullable()
  .transform((value) => value ?? null);

export const tenantWatermarkConfigSchema = z
  .object({
    enabled: z.boolean(),
    textMode: tenantWatermarkTextModeSchema,
    customText: nullableCustomTextSchema,
    applyToSharePoster: z.boolean(),
    applyToCouplePhoto: z.boolean(),
    applyToCertificate: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.textMode === 'CUSTOM' && !(value.customText?.trim().length ?? 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Custom watermark text is required when textMode is CUSTOM.',
        path: ['customText'],
      });
    }
  });

export const tenantWatermarkEntitlementSchema = z.object({
  plan: tenantSubscriptionPlanSchema,
  status: tenantSubscriptionStatusSchema,
  canEdit: z.boolean(),
  reason: z.string().nullable(),
});

export const tenantWatermarkEffectiveSchema = z.object({
  enabled: z.boolean(),
  watermarkText: z.string().trim().min(1).max(TENANT_WATERMARK_MAX_TEXT_LENGTH).nullable(),
  applyToSharePoster: z.boolean(),
  applyToCouplePhoto: z.boolean(),
  applyToCertificate: z.boolean(),
});

export const tenantWatermarkStateSchema = z.object({
  entitlement: tenantWatermarkEntitlementSchema,
  config: tenantWatermarkConfigSchema,
  effective: tenantWatermarkEffectiveSchema,
});

export const getTenantWatermarkResponseSchema = tenantWatermarkStateSchema;

export const updateTenantWatermarkRequestSchema = z.object({
  config: tenantWatermarkConfigSchema,
});

export const updateTenantWatermarkResponseSchema = tenantWatermarkStateSchema;

export type TenantWatermarkTextMode = z.infer<typeof tenantWatermarkTextModeSchema>;
export type TenantWatermarkConfig = z.infer<typeof tenantWatermarkConfigSchema>;
export type TenantWatermarkEntitlement = z.infer<typeof tenantWatermarkEntitlementSchema>;
export type TenantWatermarkEffective = z.infer<typeof tenantWatermarkEffectiveSchema>;
export type TenantWatermarkState = z.infer<typeof tenantWatermarkStateSchema>;
export type GetTenantWatermarkResponse = z.infer<typeof getTenantWatermarkResponseSchema>;
export type UpdateTenantWatermarkRequest = z.infer<typeof updateTenantWatermarkRequestSchema>;
export type UpdateTenantWatermarkResponse = z.infer<typeof updateTenantWatermarkResponseSchema>;
