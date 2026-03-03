export type ShareSource = 'share' | 'direct';

const DEFAULT_SHARE_SOURCE_NEXT = '/app?intent=dashboard&source=share';

export function resolvePostAuthRedirect(
  defaultPath: string,
  search: string,
  shareSourceNext = DEFAULT_SHARE_SOURCE_NEXT,
): string {
  const searchParams = new URLSearchParams(search);
  const safeNext = sanitizeInternalNext(searchParams.get('next'));
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
