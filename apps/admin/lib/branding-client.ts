'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_PLATFORM_BRANDING,
  loadPlatformBranding,
  type PlatformBrandingConfig,
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
