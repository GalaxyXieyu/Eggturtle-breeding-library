import { ApiError } from './api-client';

export function formatApiError(error: unknown, fallback = '未知错误') {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
