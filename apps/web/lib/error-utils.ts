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
    return '当前账号还没完成初始化，请先到「我的」页补全用户名、密码和密保信息。';
  }

  if (rawMessage.includes('No tenant selected in access token.')) {
    return '当前账号还未绑定可用空间，请重新登录后重试。';
  }

  return rawMessage;
}
