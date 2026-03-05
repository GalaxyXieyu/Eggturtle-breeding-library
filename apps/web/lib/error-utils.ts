import { ApiError } from './api-client';

export function formatApiError(error: unknown, fallback = '未知错误') {
  const rawMessage = extractRawErrorMessage(error);
  if (rawMessage) {
    return toBusinessErrorMessage(rawMessage);
  }

  return fallback;
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

function toBusinessErrorMessage(rawMessage: string) {
  if (rawMessage.includes('User is not a member of this tenant.')) {
    return '当前登录链接对应的空间不可用，正在为你切换到可用工作台。';
  }

  if (rawMessage.includes('Tenant not found.')) {
    return '当前空间不存在或已失效，正在为你切换到可用工作台。';
  }

  if (rawMessage.includes('No tenant selected in access token.')) {
    return '当前账号还未绑定可用空间，请重新登录后重试。';
  }

  if (rawMessage.includes('Phone number is already bound to another account.')) {
    return '该手机号已绑定其他账号，请更换手机号后重试。';
  }

  if (rawMessage.includes('Phone number is not allowed for this account.')) {
    return '该手机号已失效，请使用当前绑定手机号登录或在账号中完成换绑。';
  }

  if (rawMessage.includes('Old phone verification code is required.')) {
    return '更换手机号前，请先输入原手机号收到的验证码。';
  }

  if (rawMessage.includes('Current bound phone is missing.')) {
    return '当前账号未检测到已绑定手机号，请先完成手机号绑定。';
  }

  if (rawMessage.includes('Code is invalid.')) {
    return '验证码不正确，请重新输入。';
  }

  if (rawMessage.includes('Code is expired.')) {
    return '验证码已过期，请重新发送。';
  }

  if (rawMessage.includes('Current password is incorrect.')) {
    return '当前密码不正确，请重新输入。';
  }

  if (rawMessage.includes('New password must be different from current password.')) {
    return '新密码不能和当前密码相同，请更换后重试。';
  }

  if (rawMessage.includes('Password must be at least 8 characters.')) {
    return '登录密码至少 8 位，建议使用字母与数字组合。';
  }

  return rawMessage;
}
