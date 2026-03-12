import { ErrorCode } from '@eggturtle/shared';
import { NextResponse } from 'next/server';

type ErrorPayload = {
  error?: string;
  errorCode?: string | null;
  message?: string;
};

export async function parseErrorPayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text } satisfies ErrorPayload;
  }
}

export function getErrorCode(payload: unknown, fallback: string | null = null) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  if ('errorCode' in payload && typeof payload.errorCode === 'string') {
    return payload.errorCode;
  }

  return fallback;
}

export function getErrorMessage(payload: unknown, fallback = 'Request failed.') {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  if ('error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  return fallback;
}

export function createErrorResponse(
  status: number,
  errorCode: string | null,
  message = 'Request failed.',
) {
  return NextResponse.json(
    {
      message,
      ...(errorCode ? { errorCode } : {}),
    },
    { status },
  );
}

export function createStandardErrorResponse(
  status: number,
  payload: unknown,
  fallbackMessage = 'Request failed.',
  fallbackErrorCode: string | null = null,
) {
  const statusFallback =
    status === 400
      ? ErrorCode.InvalidRequestPayload
      : status === 401
        ? ErrorCode.Unauthorized
        : status === 403
          ? ErrorCode.Forbidden
          : status >= 500
            ? ErrorCode.ApiUnavailable
            : null;

  return createErrorResponse(
    status,
    getErrorCode(payload, fallbackErrorCode ?? statusFallback),
    fallbackMessage,
  );
}

export function invalidRequestResponse() {
  return createErrorResponse(400, ErrorCode.InvalidRequestPayload, 'Invalid request.');
}

export function unauthorizedResponse() {
  return createErrorResponse(401, ErrorCode.Unauthorized, 'Unauthorized.');
}

export function forbiddenResponse() {
  return createErrorResponse(403, ErrorCode.Forbidden, 'Forbidden.');
}

export function unavailableResponse() {
  return createErrorResponse(503, ErrorCode.ApiUnavailable, 'Service unavailable.');
}
