import { ApiError } from '@/lib/api-client';

type ErrorLocale = 'zh' | 'en';

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

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function formatUnknownError(error: unknown, options: FormatUnknownErrorOptions = {}) {
  const locale = options.locale ?? 'zh';
  const fallback = options.fallback ?? (locale === 'zh' ? '未知错误' : 'Unknown error');
  const rawMessage = extractRawErrorMessage(error);

  if (!rawMessage) {
    return fallback;
  }

  const resolvedMessage = toBusinessErrorMessage(rawMessage, locale) ?? fallback;

  if (options.includeErrorCode && error instanceof ApiError && error.errorCode) {
    return `${resolvedMessage} (errorCode: ${error.errorCode})`;
  }

  return resolvedMessage;
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

function toBusinessErrorMessage(rawMessage: string, locale: ErrorLocale) {
  const message = rawMessage.trim();
  const validationMessage = resolveValidationMessage(message, locale);
  if (validationMessage) {
    return validationMessage;
  }

  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(message)) {
    return locale === 'zh'
      ? '网络请求失败，请检查网络连接后重试。'
      : 'Network request failed. Please check your connection and try again.';
  }

  if (/timeout|timed out/i.test(message)) {
    return locale === 'zh' ? '请求超时，请稍后重试。' : 'Request timed out. Please try again later.';
  }

  if (
    message.includes('后台访问未授权。') ||
    message.includes('Admin access denied.') ||
    message.includes('This account does not have super-admin access.') ||
    message.includes('User is not in the super-admin allowlist.')
  ) {
    return locale === 'zh'
      ? '当前账号没有后台超级管理员权限，请使用超级管理员账号登录。'
      : 'This account does not have super-admin access.';
  }

  if (
    message.includes('Unauthorized') ||
    message.includes('Invalid admin session.') ||
    message.includes('Missing admin session.')
  ) {
    return locale === 'zh' ? '登录状态已失效，请重新登录。' : 'Your admin session has expired. Please sign in again.';
  }

  if (message.includes('Login identifier or password is incorrect.')) {
    return locale === 'zh'
      ? '账号名 / 手机号 / 邮箱或密码不正确，请重新输入。'
      : 'The account, phone number, email, or password is incorrect.';
  }

  if (message.includes('Code is invalid.')) {
    return locale === 'zh' ? '验证码不正确，请重新输入。' : 'The verification code is invalid.';
  }

  if (message.includes('Code is expired.')) {
    return locale === 'zh' ? '验证码已过期，请重新获取。' : 'The verification code has expired.';
  }

  if (message.includes('Current password is incorrect.')) {
    return locale === 'zh' ? '当前密码不正确，请重新输入。' : 'The current password is incorrect.';
  }

  if (message.includes('New password must be different from current password.')) {
    return locale === 'zh'
      ? '新密码不能与当前密码相同。'
      : 'The new password must be different from the current password.';
  }

  if (message.includes('Email code login is only available for existing accounts.')) {
    return locale === 'zh'
      ? '该邮箱尚未开通后台账号，请先确认管理员身份后再登录。'
      : 'Email code sign-in is only available for existing admin accounts.';
  }

  if (message.includes('Phone number is not registered.')) {
    return locale === 'zh'
      ? '该手机号尚未绑定后台账号，请先确认超级管理员手机号绑定。'
      : 'This phone number is not bound to an admin account.';
  }

  if (message.includes('Invalid request payload.')) {
    return locale === 'zh'
      ? '提交的信息不完整或格式不正确，请检查后重试。'
      : 'The submitted data is incomplete or invalid. Please review it and try again.';
  }

  if (/^request failed with status \d+/i.test(message)) {
    return locale === 'zh' ? '请求失败，请稍后重试。' : message;
  }

  return translateKnownValidationText(message, locale) ?? message;
}

function resolveValidationMessage(rawMessage: string, locale: ErrorLocale) {
  const parsedPayload = tryParseJson(rawMessage);
  if (!parsedPayload) {
    return null;
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

  const labels: Record<string, { zh: string; en: string }> = {
    account: { zh: '账号名', en: 'Account' },
    login: { zh: '账号名、手机号或邮箱', en: 'Account, phone, or email' },
    email: { zh: '邮箱', en: 'Email' },
    password: { zh: '密码', en: 'Password' },
    phoneNumber: { zh: '手机号', en: 'Phone number' },
    code: { zh: '验证码', en: 'Verification code' }
  };

  return labels[key]?.[locale] ?? (locale === 'zh' ? '输入内容' : 'The input');
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
