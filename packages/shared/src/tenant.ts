import { z } from 'zod';

export const tenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must contain lowercase letters, numbers, and hyphens.');

export const tenantNameSchema = z.string().trim().min(1).max(120);
export const tenantRoleSchema = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']);
export const effectiveTenantRoleSchema = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']);

export const tenantSchema = z.object({
  id: z.string().min(1),
  slug: tenantSlugSchema,
  name: tenantNameSchema
});

export const tenantMembershipSchema = z.object({
  tenant: tenantSchema,
  role: tenantRoleSchema
});

export const createTenantRequestSchema = z.object({
  slug: tenantSlugSchema,
  name: tenantNameSchema
});

export const createTenantResponseSchema = z.object({
  tenant: tenantSchema,
  role: tenantRoleSchema
});

export const myTenantsResponseSchema = z.object({
  tenants: z.array(tenantMembershipSchema)
});

export const switchTenantRequestSchema = z
  .object({
    tenantId: z.string().trim().min(1).optional(),
    slug: tenantSlugSchema.optional()
  })
  .refine((payload) => Boolean(payload.tenantId || payload.slug), {
    message: 'tenantId or slug is required.',
    path: ['tenantId']
  });

export const switchTenantResponseSchema = z.object({
  accessToken: z.string().min(1),
  tenant: tenantSchema,
  role: tenantRoleSchema
});

export const currentTenantResponseSchema = z.object({
  tenant: tenantSchema,
  role: tenantRoleSchema
});

export function normalizeTenantRole(role: TenantRole): EffectiveTenantRole {
  return role;
}

export type CreateTenantRequest = z.infer<typeof createTenantRequestSchema>;
export type CreateTenantResponse = z.infer<typeof createTenantResponseSchema>;
export type MyTenantsResponse = z.infer<typeof myTenantsResponseSchema>;
export type SwitchTenantRequest = z.infer<typeof switchTenantRequestSchema>;
export type SwitchTenantResponse = z.infer<typeof switchTenantResponseSchema>;
export type CurrentTenantResponse = z.infer<typeof currentTenantResponseSchema>;
export type Tenant = z.infer<typeof tenantSchema>;
export type TenantMembership = z.infer<typeof tenantMembershipSchema>;
export type TenantRole = z.infer<typeof tenantRoleSchema>;
export type EffectiveTenantRole = z.infer<typeof effectiveTenantRoleSchema>;
