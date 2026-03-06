import { ApiError } from './api-client';

type ErrorLocale = 'zh' | 'en';

export function formatApiError(error: unknown, fallback?: string, locale: ErrorLocale = 'zh') {
  const defaultFallback = locale === 'zh' ? '未知错误' : 'Unknown error';
  const rawMessage = extractRawErrorMessage(error);
  if (rawMessage) {
    return toBusinessErrorMessage(rawMessage, locale);
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

function toBusinessErrorMessage(rawMessage: string, locale: ErrorLocale) {
  if (
    /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(rawMessage)
  ) {
    return locale === 'zh'
      ? '网络请求失败，请检查网络后重试。'
      : 'Network request failed. Please check your connection and try again.';
  }

  if (/timeout|timed out/i.test(rawMessage)) {
    return locale === 'zh'
      ? '请求超时，请稍后再试。'
      : 'Request timed out. Please try again later.';
  }

  if (rawMessage.includes('User is not a member of this tenant.')) {
    return locale === 'zh'
      ? '当前登录链接对应的空间不可用，正在为你切换到可用工作台。'
      : 'This workspace is no longer available. Redirecting you to an available workspace.';
  }

  if (rawMessage.includes('Tenant not found.')) {
    return locale === 'zh'
      ? '当前空间不存在或已失效，正在为你切换到可用工作台。'
      : 'This workspace no longer exists. Redirecting you to an available workspace.';
  }

  if (rawMessage.includes('No tenant selected in access token.')) {
    return locale === 'zh'
      ? '当前账号还未绑定可用空间，请重新登录后重试。'
      : 'No workspace is bound to this account yet. Please sign in again.';
  }

  if (rawMessage.includes('Login identifier or password is incorrect.')) {
    return locale === 'zh'
      ? '账号/手机号或密码不正确，请重新输入。'
      : 'The account, phone number, or password is incorrect.';
  }

  if (rawMessage.includes('Phone number is not registered.')) {
    return locale === 'zh'
      ? '该手机号尚未注册，请先完成开户注册。'
      : 'This phone number has not been registered yet.';
  }

  if (rawMessage.includes('Phone number is already registered.')) {
    return locale === 'zh'
      ? '该手机号已注册，请直接登录。'
      : 'This phone number has already been registered.';
  }

  if (rawMessage.includes('Account is already taken.')) {
    return locale === 'zh' ? '该账号已被占用，请更换后重试。' : 'This account is already taken.';
  }

  if (rawMessage.includes('Phone number is already bound to another account.')) {
    return locale === 'zh'
      ? '该手机号已绑定其他账号，请更换手机号后重试。'
      : 'This phone number is already bound to another account.';
  }

  if (rawMessage.includes('Phone number is not allowed for this account.')) {
    return locale === 'zh'
      ? '该手机号已失效，请使用当前绑定手机号登录或在账号中完成换绑。'
      : 'This phone number is not allowed for this account.';
  }

  if (rawMessage.includes('Old phone verification code is required.')) {
    return locale === 'zh'
      ? '更换手机号前，请先输入原手机号收到的验证码。'
      : 'Enter the verification code from the old phone number first.';
  }

  if (rawMessage.includes('Current bound phone is missing.')) {
    return locale === 'zh'
      ? '当前账号未检测到已绑定手机号，请先完成手机号绑定。'
      : 'No current bound phone number was found for this account.';
  }

  if (rawMessage.includes('Current password is incorrect.')) {
    return locale === 'zh' ? '当前密码不正确，请重新输入。' : 'The current password is incorrect.';
  }

  if (rawMessage.includes('New password must be different from current password.')) {
    return locale === 'zh'
      ? '新密码不能和当前密码相同，请更换后重试。'
      : 'Choose a new password that is different from the current one.';
  }

  if (rawMessage.includes('Code is invalid.')) {
    return locale === 'zh' ? '验证码不正确，请重新输入。' : 'The verification code is invalid.';
  }

  if (rawMessage.includes('Code is expired.')) {
    return locale === 'zh' ? '验证码已过期，请重新发送。' : 'The verification code has expired.';
  }

  if (rawMessage.includes('Password must be at least 8 characters.')) {
    return locale === 'zh'
      ? '登录密码至少 8 位，建议使用字母与数字组合。'
      : 'Password must be at least 8 characters.';
  }

  if (rawMessage.includes('Account must be at least 4 characters.')) {
    return locale === 'zh'
      ? '账号至少 4 位，且需以字母开头。'
      : 'Account must be at least 4 characters.';
  }

  if (rawMessage.includes('Account must start with a letter')) {
    return locale === 'zh'
      ? '账号需 4-32 位、以字母开头、以字母或数字结尾，仅支持字母、数字、下划线、连字符。'
      : 'Account format is invalid.';
  }

  if (rawMessage.includes('Email code login is only available for existing accounts.')) {
    return locale === 'zh'
      ? '当前验证码仅支持已有账号验证，不能用于新账号注册。'
      : 'Verification by code is only available for existing accounts.';
  }

  return rawMessage;
}
