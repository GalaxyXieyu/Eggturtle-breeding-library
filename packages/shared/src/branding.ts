import { z } from 'zod';

import { tenantNameSchema, tenantSlugSchema } from './tenant';

const localizedBrandTextSchema = z.object({
  zh: z.string().trim().min(1).max(160),
  en: z.string().trim().min(1).max(160),
});

const localizedBrandLongTextSchema = z.object({
  zh: z.string().trim().min(1).max(280),
  en: z.string().trim().min(1).max(280),
});

const publicTitleSchema = z.string().trim().max(120).nullable();
const publicSubtitleSchema = z.string().trim().max(240).nullable();

export const platformBrandingConfigSchema = z.object({
  appName: localizedBrandTextSchema,
  appEyebrow: localizedBrandTextSchema,
  appDescription: localizedBrandLongTextSchema,
  adminTitle: localizedBrandTextSchema,
  adminSubtitle: localizedBrandLongTextSchema,
  defaultTenantName: localizedBrandTextSchema,
  publicCatalogTitleSuffix: localizedBrandTextSchema,
  publicCatalogSubtitleSuffix: localizedBrandLongTextSchema,
});

export const resolvedPlatformBrandingSchema = platformBrandingConfigSchema;

export const tenantBrandingOverrideSchema = z.object({
  displayName: tenantNameSchema.nullable(),
  publicTitle: publicTitleSchema,
  publicSubtitle: publicSubtitleSchema,
});

export const resolvedTenantBrandingSchema = z.object({
  tenant: z.object({
    id: z.string().min(1),
    slug: tenantSlugSchema,
    name: tenantNameSchema,
  }),
  platform: resolvedPlatformBrandingSchema,
  branding: tenantBrandingOverrideSchema,
  resolved: z.object({
    displayName: tenantNameSchema,
    publicTitle: z.string().trim().min(1).max(120),
    publicSubtitle: z.string().trim().min(1).max(240),
  }),
});

export const getPlatformBrandingResponseSchema = z.object({
  branding: platformBrandingConfigSchema,
});

export const updatePlatformBrandingRequestSchema = z.object({
  branding: platformBrandingConfigSchema,
});

export const updatePlatformBrandingResponseSchema = z.object({
  branding: platformBrandingConfigSchema,
  auditLogId: z.string().min(1),
});

export const getResolvedPlatformBrandingResponseSchema = z.object({
  branding: resolvedPlatformBrandingSchema,
});

export const getAdminTenantBrandingResponseSchema = z.object({
  tenant: resolvedTenantBrandingSchema.shape.tenant,
  branding: tenantBrandingOverrideSchema,
  resolved: resolvedTenantBrandingSchema.shape.resolved,
});

export const updateAdminTenantBrandingRequestSchema = z.object({
  branding: tenantBrandingOverrideSchema,
});

export const updateAdminTenantBrandingResponseSchema = z.object({
  tenant: resolvedTenantBrandingSchema.shape.tenant,
  branding: tenantBrandingOverrideSchema,
  resolved: resolvedTenantBrandingSchema.shape.resolved,
  auditLogId: z.string().min(1),
});

export const getResolvedTenantBrandingResponseSchema = z.object({
  branding: resolvedTenantBrandingSchema,
});

export const DEFAULT_PLATFORM_BRANDING = platformBrandingConfigSchema.parse({
  appName: {
    zh: '选育溯源档案',
    en: 'Breeding Traceability Record',
  },
  appEyebrow: {
    zh: 'Breeding Traceability Record',
    en: '选育溯源档案',
  },
  appDescription: {
    zh: '让每一条选育、配对、产蛋与孵化记录，都沉淀为可查、可验、可复盘的繁育档案。',
    en: 'A trusted workspace for breeder records, pairing timelines, and hatch traceability.',
  },
  adminTitle: {
    zh: '选育溯源档案 平台后台',
    en: 'Breeding Traceability Record Admin Console',
  },
  adminSubtitle: {
    zh: '跨用户运维控制台',
    en: 'Cross-tenant operations control',
  },
  defaultTenantName: {
    zh: '选育溯源档案',
    en: 'Breeding Traceability Record',
  },
  publicCatalogTitleSuffix: {
    zh: '公开图鉴',
    en: 'Public Catalog',
  },
  publicCatalogSubtitleSuffix: {
    zh: '在库产品展示',
    en: 'Catalog showcase',
  },
});

export const DEFAULT_TENANT_BRANDING_OVERRIDE = tenantBrandingOverrideSchema.parse({
  displayName: null,
  publicTitle: null,
  publicSubtitle: null,
});

export type PlatformBrandingConfig = z.infer<typeof platformBrandingConfigSchema>;
export type ResolvedPlatformBranding = z.infer<typeof resolvedPlatformBrandingSchema>;
export type TenantBrandingOverride = z.infer<typeof tenantBrandingOverrideSchema>;
export type ResolvedTenantBranding = z.infer<typeof resolvedTenantBrandingSchema>;
export type GetPlatformBrandingResponse = z.infer<typeof getPlatformBrandingResponseSchema>;
export type UpdatePlatformBrandingRequest = z.infer<typeof updatePlatformBrandingRequestSchema>;
export type UpdatePlatformBrandingResponse = z.infer<typeof updatePlatformBrandingResponseSchema>;
export type GetResolvedPlatformBrandingResponse = z.infer<typeof getResolvedPlatformBrandingResponseSchema>;
export type GetAdminTenantBrandingResponse = z.infer<typeof getAdminTenantBrandingResponseSchema>;
export type UpdateAdminTenantBrandingRequest = z.infer<typeof updateAdminTenantBrandingRequestSchema>;
export type UpdateAdminTenantBrandingResponse = z.infer<typeof updateAdminTenantBrandingResponseSchema>;
export type GetResolvedTenantBrandingResponse = z.infer<typeof getResolvedTenantBrandingResponseSchema>;
