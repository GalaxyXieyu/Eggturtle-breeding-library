import 'server-only';

import { ErrorCode } from '@eggturtle/shared';
import { meResponseSchema, type AuthUser } from '@eggturtle/shared/auth';

import { ADMIN_SESSION_COOKIE_NAME } from '@/lib/session-constants';

const DEFAULT_API_BASE_URL = 'http://localhost:30011';
const DEFAULT_ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export const ADMIN_ACCESS_COOKIE_NAME = ADMIN_SESSION_COOKIE_NAME;

type AuthValidationResult =
  | {
      ok: true;
      user: AuthUser;
    }
  | {
      ok: false;
      status: number;
      message: string;
      errorCode: string | null;
    };

function getAdminSessionMaxAgeSeconds() {
  const configuredValue = Number(process.env.ADMIN_AUTH_COOKIE_MAX_AGE_SECONDS);

  if (!Number.isFinite(configuredValue) || configuredValue <= 0) {
    return DEFAULT_ADMIN_SESSION_MAX_AGE_SECONDS;
  }

  return Math.floor(configuredValue);
}

export function getApiBaseUrl() {
  return process.env.ADMIN_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: getAdminSessionMaxAgeSeconds()
  };
}

export function clearAdminSessionCookieOptions() {
  return {
    ...getAdminSessionCookieOptions(),
    maxAge: 0
  };
}

export async function validateAdminAccessToken(token: string): Promise<AuthValidationResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: response.status === 401 ? 'Unauthorized.' : 'Service unavailable.',
        errorCode: response.status === 401 ? ErrorCode.Unauthorized : ErrorCode.ApiUnavailable
      };
    }

    const payload = meResponseSchema.parse(await response.json());
    if (!payload.user.isSuperAdmin) {
      return {
        ok: false,
        status: 403,
        message: 'Forbidden.',
        errorCode: ErrorCode.Forbidden
      };
    }

    return {
      ok: true,
      user: payload.user
    };
  } catch (error) {
    console.error('[admin-auth] Failed to validate admin access token.', error);

    return {
      ok: false,
      status: 503,
      message: 'Service unavailable.',
      errorCode: ErrorCode.ApiUnavailable
    };
  }
}
