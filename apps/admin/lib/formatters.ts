import { ErrorCode } from '@eggturtle/shared';

import type { UiLocale } from '@/components/ui-preferences';
import { ApiError } from '@/lib/api-client';
import {
  ADMIN_ERROR_MESSAGES,
  GENERIC_ERROR_MESSAGES,
  NETWORK_ERROR_MESSAGES,
  VALIDATION_FIELD_MESSAGES,
} from '@/lib/locales/error-messages';

type ErrorLocale = UiLocale;

type FormatUnknownErrorOptions = {
  fallback?: string;
  includeErrorCode?: boolean;
  locale?: ErrorLocale;
};

type ValidationIssue = {
  code?: unknown;
  expected?: unknown;
  path?: unknown;
  message?: unknown;
  received?: unknown;
};

export function formatDateTime(value: string, locale: ErrorLocale = 'zh') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
}

export function formatUnknownError(error: unknown, options: FormatUnknownErrorOptions = {}) {
  const locale = resolveLocale(options.locale);
  const fallback = options.fallback ?? GENERIC_ERROR_MESSAGES[locale];

  const errorCode = extractErrorCode(error);
  if (errorCode) {
    const mapped = ADMIN_ERROR_MESSAGES[locale][errorCode as ErrorCode];
    if (mapped) {
      return mapped;
    }
  }

  const rawMessage = extractRawErrorMessage(error);
  if (!rawMessage) {
    return fallback;
  }

  const validationMessage = resolveValidationMessage(rawMessage, locale);
  if (validationMessage) {
    return validationMessage;
  }

  const networkMessage = toNetworkErrorMessage(rawMessage, locale);
  if (networkMessage) {
    return networkMessage;
  }

  const compatibilityMessage = toCompatibilityMessage(rawMessage, locale);
  if (compatibilityMessage) {
    return compatibilityMessage;
  }

  return fallback;
}

function extractRawErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return null;
}

function extractErrorCode(error: unknown) {
  if (error instanceof ApiError) {
    if (error.errorCode) {
      return error.errorCode;
    }

    if (error.status === 401) {
      return ErrorCode.Unauthorized;
    }

    if (error.status === 403) {
      return ErrorCode.Forbidden;
    }
  }

  return null;
}

function resolveLocale(locale?: ErrorLocale): ErrorLocale {
  if (locale === 'zh' || locale === 'en') {
    return locale;
  }

  if (typeof document !== 'undefined') {
    const docLocale = document.documentElement.dataset.locale ?? document.body.dataset.locale;
    if (docLocale === 'en') {
      return 'en';
    }
  }

  return 'zh';
}

function toNetworkErrorMessage(rawMessage: string, locale: ErrorLocale) {
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(rawMessage)) {
    return NETWORK_ERROR_MESSAGES[locale].network;
  }

  if (/timeout|timed out/i.test(rawMessage)) {
    return NETWORK_ERROR_MESSAGES[locale].timeout;
  }

  return null;
}

function toCompatibilityMessage(rawMessage: string, locale: ErrorLocale) {
  const message = rawMessage.trim();

  if (/^request failed with status \d+/i.test(message)) {
    return GENERIC_ERROR_MESSAGES[locale];
  }

  if (
    message.includes('Invalid admin session.') ||
    message.includes('Missing admin session.') ||
    message.includes('Unauthorized.')
  ) {
    return ADMIN_ERROR_MESSAGES[locale][ErrorCode.Unauthorized] ?? GENERIC_ERROR_MESSAGES[locale];
  }

  if (message.includes('Admin access denied.') || message.includes('Forbidden.')) {
    return ADMIN_ERROR_MESSAGES[locale][ErrorCode.Forbidden] ?? GENERIC_ERROR_MESSAGES[locale];
  }

  if (message.includes('Service unavailable.')) {
    return ADMIN_ERROR_MESSAGES[locale][ErrorCode.ApiUnavailable] ?? GENERIC_ERROR_MESSAGES[locale];
  }

  return null;
}

function resolveValidationMessage(rawMessage: string, locale: ErrorLocale) {
  const parsedPayload = tryParseJson(rawMessage);
  if (!parsedPayload) {
    return translateKnownValidationText(rawMessage.trim(), locale);
  }

  const firstIssue = extractFirstIssue(parsedPayload);
  if (!firstIssue) {
    return null;
  }

  return translateValidationIssue(firstIssue, locale);
}

function tryParseJson(rawMessage: string) {
  if (!rawMessage.startsWith('{') && !rawMessage.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(rawMessage) as unknown;
  } catch {
    return null;
  }
}

function extractFirstIssue(payload: unknown): ValidationIssue | null {
  if (Array.isArray(payload)) {
    return asValidationIssue(payload[0]);
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if ('issues' in payload) {
    const issues = (payload as { issues?: unknown }).issues;
    if (Array.isArray(issues)) {
      return asValidationIssue(issues[0]);
    }
  }

  if ('first' in payload) {
    return asValidationIssue((payload as { first?: unknown }).first);
  }

  return null;
}

function asValidationIssue(value: unknown): ValidationIssue | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as ValidationIssue;
}

function translateValidationIssue(issue: ValidationIssue, locale: ErrorLocale) {
  const field = resolveFieldLabel(issue.path, locale);
  const message = typeof issue.message === 'string' ? issue.message : '';
  const translatedMessage = translateKnownValidationText(message, locale);

  if (translatedMessage) {
    return translatedMessage;
  }

  if (issue.code === 'invalid_type') {
    if (field) {
      return locale === 'zh' ? `${field}不能为空。` : `${field} is required.`;
    }

    return locale === 'zh' ? '请补全必填信息后重试。' : 'Please complete the required fields and try again.';
  }

  if (field) {
    return locale === 'zh' ? `${field}格式不正确，请检查后重试。` : `${field} is invalid. Please check it and try again.`;
  }

  return locale === 'zh' ? '输入内容格式不正确，请检查后重试。' : 'The submitted value is invalid.';
}

function resolveFieldLabel(path: unknown, locale: ErrorLocale) {
  const firstSegment = Array.isArray(path) ? path[0] : null;
  const key = typeof firstSegment === 'string' ? firstSegment : '';

  if (!key) {
    return locale === 'zh' ? '输入内容' : 'The input';
  }

  return VALIDATION_FIELD_MESSAGES[locale][key] ?? (locale === 'zh' ? '输入内容' : 'The input');
}

function translateKnownValidationText(message: string, locale: ErrorLocale) {
  if (!message) {
    return null;
  }

  if (message.includes('Invalid email')) {
    return locale === 'zh' ? '请输入正确的邮箱地址。' : 'Enter a valid email address.';
  }

  if (message.includes('Login identifier is required.')) {
    return locale === 'zh'
      ? '请输入后台账号、手机号，或旧邮箱。'
      : 'Enter your admin account, phone number, or legacy email.';
  }

  if (message.includes('Password must be at least 8 characters.')) {
    return locale === 'zh' ? '登录密码至少 8 位。' : 'Password must be at least 8 characters.';
  }

  if (message.includes('Account must be at least 4 characters.')) {
    return locale === 'zh' ? '账号名至少 4 位，且需以字母开头。' : 'Account must be at least 4 characters.';
  }

  if (message.includes('Account must start with a letter')) {
    return locale === 'zh'
      ? '账号名需 4-32 位、以字母开头、以字母或数字结尾，仅支持字母、数字、下划线、连字符。'
      : 'Account format is invalid.';
  }

  if (message.includes('Code must be a 6-digit number.')) {
    return locale === 'zh' ? '请输入 6 位数字验证码。' : 'Enter the 6-digit verification code.';
  }

  if (message.includes('Phone number must be an 11-digit mainland China mobile number.')) {
    return locale === 'zh' ? '请输入正确的 11 位中国大陆手机号。' : 'Enter a valid 11-digit mainland China mobile number.';
  }

  return null;
}
