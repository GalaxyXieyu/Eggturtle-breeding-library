export type ShareSource = 'share' | 'direct';

const DEFAULT_SHARE_SOURCE_NEXT = '/app?intent=dashboard&source=share';

type ResolvePostAuthRedirectOptions = {
  allowedTenantSlug?: string | null;
  allowGenericAppEntryNext?: boolean;
};

export function resolvePostAuthRedirect(
  defaultPath: string,
  search: string,
  shareSourceNext = DEFAULT_SHARE_SOURCE_NEXT,
  options: ResolvePostAuthRedirectOptions = {},
): string {
  const searchParams = new URLSearchParams(search);
  const safeNext = sanitizeTenantAwareNext(searchParams.get('next'), options);
  if (safeNext) {
    return safeNext;
  }

  const source = normalizeShareSource(searchParams.get('source'));
  if (source === 'share') {
    return shareSourceNext;
  }

  return defaultPath;
}

export function normalizeShareSource(value: string | null): ShareSource {
  if (value?.trim().toLowerCase() === 'share') {
    return 'share';
  }

  return 'direct';
}

export function sanitizeInternalNext(value: string | null): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if (!normalized.startsWith('/')) {
    return null;
  }

  if (normalized.startsWith('//') || normalized.startsWith('/\\')) {
    return null;
  }

  return normalized;
}

function sanitizeTenantAwareNext(
  value: string | null,
  options: ResolvePostAuthRedirectOptions,
): string | null {
  const safeNext = sanitizeInternalNext(value);
  if (!safeNext) {
    return null;
  }

  const allowedTenantSlug = options.allowedTenantSlug?.trim();
  if (!allowedTenantSlug) {
    return safeNext;
  }

  if (safeNext.startsWith(`/app/${allowedTenantSlug}`)) {
    return safeNext;
  }

  const allowGenericAppEntryNext = options.allowGenericAppEntryNext ?? true;
  if (allowGenericAppEntryNext && (safeNext === '/app' || safeNext.startsWith('/app?'))) {
    return safeNext;
  }

  return null;
}
