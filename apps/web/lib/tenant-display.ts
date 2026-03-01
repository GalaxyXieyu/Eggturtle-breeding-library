export function formatTenantDisplayName(slug: string | null | undefined, fallback: string): string {
  if (!slug) {
    return fallback;
  }

  const normalized = slug.trim();
  if (!normalized) {
    return fallback;
  }

  const withoutSuffix = normalized.replace(/-sync-smoke$/i, '');
  return withoutSuffix || fallback;
}
