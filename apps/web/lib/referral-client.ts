import {
  bindReferralFromAttributionRequestSchema,
  bindReferralFromAttributionResponseSchema,
  bindReferralRequestSchema,
  bindReferralResponseSchema,
  myReferralOverviewResponseSchema,
  publicReferralLandingResponseSchema,
  type BindReferralFromAttributionRequest,
  type BindReferralRequest,
  type MyReferralOverviewResponse,
} from '@eggturtle/shared';

import { apiRequest } from '@/lib/api-client';

const PENDING_REFERRAL_STORAGE_KEY = 'eggturtle.pending-referral-code:v1';
const REFERRAL_PROMO_DISMISSED_KEY_PREFIX = 'eggturtle.referral-promo-dismissed:v1:';
const REFERRAL_AUTH_NOTICE_STORAGE_KEY = 'eggturtle.referral-auth-notice:v1';

function canUseStorage() {
  return typeof window !== 'undefined';
}

export function normalizeReferralCode(rawValue: string | null | undefined): string {
  return (rawValue ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function getPendingReferralCode(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  const stored = window.localStorage.getItem(PENDING_REFERRAL_STORAGE_KEY);
  const normalized = normalizeReferralCode(stored);
  return normalized || null;
}

export function stashPendingReferralCode(rawValue: string | null | undefined): string | null {
  const normalized = normalizeReferralCode(rawValue);
  if (!normalized || !canUseStorage()) {
    return null;
  }

  const existing = getPendingReferralCode();
  if (existing) {
    return existing;
  }

  window.localStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, normalized);
  return normalized;
}

export function clearPendingReferralCode(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(PENDING_REFERRAL_STORAGE_KEY);
}

export function isReferralPromoDismissed(tenantSlug: string): boolean {
  if (!tenantSlug || !canUseStorage()) {
    return false;
  }

  return window.localStorage.getItem(`${REFERRAL_PROMO_DISMISSED_KEY_PREFIX}${tenantSlug}`) === '1';
}

export function markReferralPromoDismissed(tenantSlug: string): void {
  if (!tenantSlug || !canUseStorage()) {
    return;
  }

  window.localStorage.setItem(`${REFERRAL_PROMO_DISMISSED_KEY_PREFIX}${tenantSlug}`, '1');
}

export function stashReferralAuthNotice(message: string): void {
  if (!canUseStorage()) {
    return;
  }

  const normalized = message.trim();
  if (!normalized) {
    return;
  }

  window.sessionStorage.setItem(REFERRAL_AUTH_NOTICE_STORAGE_KEY, normalized);
}

export function consumeReferralAuthNotice(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  const message = window.sessionStorage.getItem(REFERRAL_AUTH_NOTICE_STORAGE_KEY)?.trim() ?? '';
  window.sessionStorage.removeItem(REFERRAL_AUTH_NOTICE_STORAGE_KEY);
  return message || null;
}

export function resolveReferralShareUrl(
  overview: Pick<MyReferralOverviewResponse, 'sharePath' | 'shareUrl'> | null | undefined,
): string {
  if (!overview) {
    return '';
  }

  if (/^https?:\/\//i.test(overview.shareUrl)) {
    return overview.shareUrl;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${overview.sharePath}`;
  }

  return overview.shareUrl;
}

export async function fetchMyReferralOverview(signal?: AbortSignal) {
  return apiRequest('/me/referral', {
    method: 'GET',
    signal,
    responseSchema: myReferralOverviewResponseSchema,
  });
}

export async function fetchPublicReferralLanding(referralCode: string, signal?: AbortSignal) {
  const normalized = normalizeReferralCode(referralCode);
  return apiRequest(`/public/referrals/${encodeURIComponent(normalized)}`, {
    auth: false,
    method: 'GET',
    signal,
    responseSchema: publicReferralLandingResponseSchema,
  });
}

export async function bindReferralCode(
  referralCode: string,
  source: BindReferralRequest['source'] = 'manual_fallback',
) {
  return apiRequest('/referrals/bind', {
    method: 'POST',
    body: {
      referralCode: normalizeReferralCode(referralCode),
      source,
    },
    requestSchema: bindReferralRequestSchema,
    responseSchema: bindReferralResponseSchema,
  });
}

export async function bindReferralFromAttribution(input: BindReferralFromAttributionRequest) {
  return apiRequest('/referrals/bind-from-attribution', {
    method: 'POST',
    body: input,
    requestSchema: bindReferralFromAttributionRequestSchema,
    responseSchema: bindReferralFromAttributionResponseSchema,
  });
}
