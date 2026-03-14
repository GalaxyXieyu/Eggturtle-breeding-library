import {
  DEFAULT_PLATFORM_BRANDING,
  getResolvedPlatformBrandingResponseSchema,
  type PlatformBrandingConfig,
} from './branding';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:30011';

function readEnv(name: string) {
  const processLike = globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return processLike.process?.env?.[name];
}

export function getPlatformBrandingApiBaseUrl() {
  return readEnv('INTERNAL_API_BASE_URL') ?? readEnv('NEXT_PUBLIC_API_BASE_URL') ?? DEFAULT_API_BASE_URL;
}

export async function fetchPlatformBrandingServerConfig(
  fetchImpl: typeof fetch = fetch,
): Promise<PlatformBrandingConfig> {
  try {
    const response = await fetchImpl(`${getPlatformBrandingApiBaseUrl()}/branding/platform`, {
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
}
