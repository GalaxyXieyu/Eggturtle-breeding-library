import {
  DEFAULT_PLATFORM_BRANDING,
  DEFAULT_TENANT_BRANDING_OVERRIDE,
  getResolvedPlatformBrandingResponseSchema,
  getResolvedTenantBrandingResponseSchema,
  type PlatformBrandingConfig,
  type ResolvedTenantBranding,
} from './branding';

type SchemaParser<T> = {
  parse(input: unknown): T;
};

type BrandingApiRequest = <TResponse>(
  path: string,
  options: {
    auth: false;
    responseSchema: SchemaParser<TResponse>;
  },
) => Promise<TResponse>;

export function buildDefaultTenantBranding(tenantSlug: string): ResolvedTenantBranding {
  const displayName = DEFAULT_PLATFORM_BRANDING.defaultTenantName.zh;

  return {
    tenant: {
      id: tenantSlug || 'default-tenant',
      slug: tenantSlug || 'default-tenant',
      name: displayName,
    },
    platform: DEFAULT_PLATFORM_BRANDING,
    branding: DEFAULT_TENANT_BRANDING_OVERRIDE,
    resolved: {
      displayName,
      publicTitle: `${displayName} · ${DEFAULT_PLATFORM_BRANDING.publicCatalogTitleSuffix.zh}`,
      publicSubtitle: `${displayName} ${DEFAULT_PLATFORM_BRANDING.publicCatalogSubtitleSuffix.zh}`,
    },
  };
}

export async function loadPlatformBranding(
  request: BrandingApiRequest,
): Promise<PlatformBrandingConfig> {
  try {
    const response = await request('/branding/platform', {
      auth: false,
      responseSchema: getResolvedPlatformBrandingResponseSchema,
    });

    return response.branding;
  } catch {
    return DEFAULT_PLATFORM_BRANDING;
  }
}

export async function loadResolvedTenantBranding(
  tenantSlug: string,
  request: BrandingApiRequest,
): Promise<ResolvedTenantBranding> {
  if (!tenantSlug.trim()) {
    return buildDefaultTenantBranding('default-tenant');
  }

  try {
    const response = await request(`/branding/tenant/${encodeURIComponent(tenantSlug)}`, {
      auth: false,
      responseSchema: getResolvedTenantBrandingResponseSchema,
    });

    return response.branding;
  } catch {
    return buildDefaultTenantBranding(tenantSlug);
  }
}
