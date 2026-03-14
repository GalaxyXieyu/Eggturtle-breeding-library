'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_PLATFORM_BRANDING,
  buildDefaultTenantBranding,
  loadPlatformBranding,
  loadResolvedTenantBranding,
  type PlatformBrandingConfig,
  type ResolvedTenantBranding,
} from '@eggturtle/shared';

import { apiRequest } from '@/lib/api-client';

export function usePlatformBranding() {
  const [branding, setBranding] = useState<PlatformBrandingConfig>(DEFAULT_PLATFORM_BRANDING);

  useEffect(() => {
    let cancelled = false;

    void loadPlatformBranding(apiRequest).then((nextBranding) => {
      if (!cancelled) {
        setBranding(nextBranding);
      }
    });

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

    void loadResolvedTenantBranding(tenantSlug, apiRequest).then((nextBranding) => {
      if (!cancelled) {
        setBranding(nextBranding);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  return branding;
}
