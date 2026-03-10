import { cache } from 'react';
import {
  DEFAULT_PLATFORM_BRANDING,
  getResolvedPlatformBrandingResponseSchema,
  type PlatformBrandingConfig,
} from '@eggturtle/shared';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:30011';

function getApiBaseUrl() {
  return process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export const getPlatformBrandingServer = cache(async (): Promise<PlatformBrandingConfig> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/branding/platform`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return DEFAULT_PLATFORM_BRANDING;
    }

    const payload = await response.json();
    return getResolvedPlatformBrandingResponseSchema.parse(payload).branding;
  } catch {
    return DEFAULT_PLATFORM_BRANDING;
  }
});
