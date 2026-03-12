import { ErrorCode } from '@eggturtle/shared';

import { ApiError } from '@/lib/api-client';
import {
  ERROR_CODE_MESSAGES,
  GENERIC_ERROR_MESSAGES,
  NETWORK_ERROR_MESSAGES,
} from '@/lib/locales/error-messages';
import type { UiLocale } from '@/components/ui-preferences';

export function formatApiError(error: unknown, fallback?: string, locale?: UiLocale) {
  const resolvedLocale = resolveErrorLocale(locale);
  const defaultFallback = GENERIC_ERROR_MESSAGES[resolvedLocale];

  const errorCode = extractErrorCode(error);
  if (errorCode) {
    const mapped = ERROR_CODE_MESSAGES[resolvedLocale][errorCode as ErrorCode];
    if (mapped) {
      return mapped;
    }
  }

  const rawMessage = extractRawErrorMessage(error);
  if (rawMessage) {
    const networkMessage = toNetworkErrorMessage(rawMessage, resolvedLocale);
    if (networkMessage) {
      return networkMessage;
    }
  }

  return fallback ?? defaultFallback;
}

function extractRawErrorMessage(error: unknown): string | null {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return null;
}

function extractErrorCode(error: unknown): string | null {
  if (error instanceof ApiError) {
    if (error.errorCode) {
      return error.errorCode;
    }
    if (error.status === 401) {
      return ErrorCode.Unauthorized;
    }
  }

  return null;
}

function resolveErrorLocale(locale?: UiLocale): UiLocale {
  if (locale === 'en' || locale === 'zh') {
    return locale;
  }

  if (typeof document !== 'undefined') {
    const docLocale =
      document.documentElement.dataset.locale ?? document.body.dataset.locale;
    if (docLocale === 'en') {
      return 'en';
    }
  }

  return 'zh';
}

function toNetworkErrorMessage(rawMessage: string, locale: UiLocale) {
  if (
    /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(rawMessage)
  ) {
    return NETWORK_ERROR_MESSAGES[locale].network;
  }

  if (/timeout|timed out/i.test(rawMessage)) {
    return NETWORK_ERROR_MESSAGES[locale].timeout;
  }

  return null;
}
