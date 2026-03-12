import type {
  BindReferralFromAttributionRequest,
  ReferralAttributionPageType,
} from '@eggturtle/shared';

const PENDING_PUBLIC_ATTRIBUTION_STORAGE_KEY = 'eggturtle.pending-public-attribution:v1';
const PENDING_PUBLIC_ATTRIBUTION_COOKIE_KEY = 'eggturtle_pending_public_attribution_v1';
const DEFAULT_ATTRIBUTION_TTL_DAYS = 30;

type PendingPublicAttribution = BindReferralFromAttributionRequest & {
  expiresAt: string;
};

function canUseBrowser() {
  return typeof window !== 'undefined';
}

export function getReferralAttributionTtlDays(): number {
  const rawValue = process.env.NEXT_PUBLIC_REFERRAL_ATTRIBUTION_TTL_DAYS?.trim();
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_ATTRIBUTION_TTL_DAYS;
  }

  return parsed;
}

export function getPendingPublicAttribution(): PendingPublicAttribution | null {
  if (!canUseBrowser()) {
    return null;
  }

  const fromStorage = parsePendingPublicAttribution(window.localStorage.getItem(PENDING_PUBLIC_ATTRIBUTION_STORAGE_KEY));
  if (fromStorage) {
    writePendingPublicAttribution(fromStorage);
    return fromStorage;
  }

  const fromCookie = parsePendingPublicAttribution(readCookie(PENDING_PUBLIC_ATTRIBUTION_COOKIE_KEY));
  if (fromCookie) {
    writePendingPublicAttribution(fromCookie);
    return fromCookie;
  }

  clearPendingPublicAttribution();
  return null;
}

export function capturePendingPublicAttribution(): PendingPublicAttribution | null {
  if (!canUseBrowser()) {
    return null;
  }

  const existing = getPendingPublicAttribution();
  if (existing) {
    return existing;
  }

  const next = buildPendingPublicAttribution(window.location.href);
  if (!next) {
    return null;
  }

  writePendingPublicAttribution(next);
  return next;
}

export function clearPendingPublicAttribution(): void {
  if (!canUseBrowser()) {
    return;
  }

  window.localStorage.removeItem(PENDING_PUBLIC_ATTRIBUTION_STORAGE_KEY);
  document.cookie = `${PENDING_PUBLIC_ATTRIBUTION_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function buildPendingPublicAttribution(fromUrl: string): PendingPublicAttribution | null {
  let parsed: URL;
  try {
    parsed = new URL(fromUrl, window.location.origin);
  } catch {
    return null;
  }

  const segments = parsed.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => safeDecodeURIComponent(segment));

  if (segments[0] !== 'public') {
    return null;
  }

  let pageType: ReferralAttributionPageType | null = null;
  let shareToken: string | null = null;
  let tenantSlug: string | null = null;
  let productId: string | null = null;
  let verifyId: string | null = null;

  if (segments[1] === 's' && segments[2]) {
    shareToken = segments[2] ?? null;
    pageType = segments[3] === 'products' && segments[4] ? 'share_product' : 'share_feed';
    productId = segments[3] === 'products' && segments[4] ? segments[4] : null;
  } else if (segments[1] === 'certificates' && segments[2] === 'verify' && segments[3]) {
    pageType = 'certificate_verify';
    verifyId = segments[3] ?? null;
  } else if (
    segments[1] &&
    segments[1] !== 'products' &&
    segments[1] !== 'breeders' &&
    segments[1] !== 'certificates'
  ) {
    tenantSlug = segments[1] ?? null;
    pageType = segments[2] === 'products' && segments[3] ? 'tenant_product' : 'tenant_feed';
    productId = segments[2] === 'products' && segments[3] ? segments[3] : null;
  }

  if (!pageType) {
    return null;
  }

  const capturedAt = new Date();
  const expiresAt = new Date(capturedAt.getTime() + getReferralAttributionTtlDays() * 24 * 60 * 60 * 1000);
  const src = parsed.searchParams.get('src')?.trim() ?? '';

  return {
    fromUrl: parsed.toString(),
    pageType,
    shareToken,
    tenantSlug,
    productId,
    verifyId,
    entrySource: src || inferEntrySource(pageType),
    capturedAt: capturedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

function inferEntrySource(pageType: ReferralAttributionPageType): string {
  if (pageType === 'certificate_verify') {
    return 'certificate';
  }

  if (pageType === 'share_product' || pageType === 'tenant_product') {
    return 'detail';
  }

  return 'share';
}

function parsePendingPublicAttribution(rawValue: string | null): PendingPublicAttribution | null {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<PendingPublicAttribution>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (
      typeof parsed.fromUrl !== 'string' ||
      typeof parsed.pageType !== 'string' ||
      typeof parsed.capturedAt !== 'string' ||
      typeof parsed.expiresAt !== 'string'
    ) {
      return null;
    }

    const expiresAtMs = Date.parse(parsed.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return null;
    }

    return {
      fromUrl: parsed.fromUrl,
      pageType: parsed.pageType as ReferralAttributionPageType,
      shareToken: normalizeOptionalText(parsed.shareToken),
      tenantSlug: normalizeOptionalText(parsed.tenantSlug),
      productId: normalizeOptionalText(parsed.productId),
      verifyId: normalizeOptionalText(parsed.verifyId),
      entrySource: normalizeOptionalText(parsed.entrySource),
      capturedAt: parsed.capturedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function writePendingPublicAttribution(value: PendingPublicAttribution): void {
  const serialized = encodeURIComponent(JSON.stringify(value));
  window.localStorage.setItem(PENDING_PUBLIC_ATTRIBUTION_STORAGE_KEY, serialized);
  const maxAgeSeconds = Math.max(Math.floor((Date.parse(value.expiresAt) - Date.now()) / 1000), 1);
  document.cookie = `${PENDING_PUBLIC_ATTRIBUTION_COOKIE_KEY}=${serialized}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function readCookie(name: string): string | null {
  if (!canUseBrowser()) {
    return null;
  }

  const prefix = `${name}=`;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
