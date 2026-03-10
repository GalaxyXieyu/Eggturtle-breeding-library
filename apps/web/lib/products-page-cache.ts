const PRODUCTS_PAGE_DIRTY_KEY_PREFIX = 'products-page-dirty:v1:';

function buildDirtyKey(tenantSlug: string) {
  return `${PRODUCTS_PAGE_DIRTY_KEY_PREFIX}${tenantSlug}`;
}

export function markProductsPageDirty(tenantSlug: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const key = buildDirtyKey(tenantSlug);
  if (!tenantSlug || !key) {
    return;
  }

  try {
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // Ignore storage write errors.
  }
}

export function readProductsPageDirtyAt(tenantSlug: string): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const key = buildDirtyKey(tenantSlug);
  if (!tenantSlug || !key) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const value = Number(raw);
    if (!Number.isFinite(value)) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

export function clearProductsPageDirty(tenantSlug: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const key = buildDirtyKey(tenantSlug);
  if (!tenantSlug || !key) {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage write errors.
  }
}
