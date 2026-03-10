'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_PLATFORM_BRANDING,
  getResolvedPlatformBrandingResponseSchema,
  type PlatformBrandingConfig,
} from '@eggturtle/shared';

import { apiRequest } from '@/lib/api-client';

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
