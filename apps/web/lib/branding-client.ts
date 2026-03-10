'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_PLATFORM_BRANDING,
  DEFAULT_TENANT_BRANDING_OVERRIDE,
  getResolvedPlatformBrandingResponseSchema,
  getResolvedTenantBrandingResponseSchema,
  type PlatformBrandingConfig,
  type ResolvedTenantBranding,
} from '@eggturtle/shared';

import { apiRequest } from '@/lib/api-client';

function buildDefaultTenantBranding(tenantSlug: string): ResolvedTenantBranding {
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

export function usePlatformBranding() {
  const [branding, setBranding] = useState<PlatformBrandingConfig>(DEFAULT_PLATFORM_BRANDING);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await apiRequest('/branding/platform', {
          auth: false,
          responseSchema: getResolvedPlatformBrandingResponseSchema,
        });

        if (!cancelled) {
          setBranding(response.branding);
        }
      } catch {
        if (!cancelled) {
          setBranding(DEFAULT_PLATFORM_BRANDING);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return branding;
}

export function useResolvedTenantBranding(tenantSlug: string) {
  const [branding, setBranding] = useState<ResolvedTenantBranding>(buildDefaultTenantBranding(tenantSlug));

  useEffect(() => {
    if (!tenantSlug.trim()) {
      setBranding(buildDefaultTenantBranding('default-tenant'));
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await apiRequest(`/branding/tenant/${encodeURIComponent(tenantSlug)}`, {
          auth: false,
          responseSchema: getResolvedTenantBrandingResponseSchema,
        });

        if (!cancelled) {
          setBranding(response.branding);
        }
      } catch {
        if (!cancelled) {
          setBranding(buildDefaultTenantBranding(tenantSlug));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  return branding;
}
