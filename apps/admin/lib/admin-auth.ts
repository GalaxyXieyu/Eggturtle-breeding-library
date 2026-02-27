import 'server-only';

import { meResponseSchema, type AuthUser } from '@eggturtle/shared/auth';

const DEFAULT_API_BASE_URL = 'http://localhost:30011';
const DEFAULT_ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export const ADMIN_ACCESS_COOKIE_NAME = 'eggturtle.admin.access_token';

type AuthValidationResult =
  | {
      ok: true;
      user: AuthUser;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

function parseAllowlist(rawValue: string | undefined) {
  return new Set(
    (rawValue ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

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

function getSuperAdminAllowlist() {
  return parseAllowlist(
    process.env.ADMIN_SUPER_EMAIL_ALLOWLIST ??
      process.env.ADMIN_SUPER_ADMIN_EMAILS ??
      process.env.SUPER_ADMIN_EMAILS
  );
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
  const allowlist = getSuperAdminAllowlist();

  if (allowlist.size === 0) {
    return {
      ok: false,
      status: 500,
      message: 'ADMIN_SUPER_EMAIL_ALLOWLIST allowlist is not configured.'
    };
  }

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
        message: response.status === 401 ? 'Invalid access token.' : 'Failed to validate access token.'
      };
    }

    const payload = meResponseSchema.parse(await response.json());
    const email = payload.user.email.toLowerCase();

    if (!allowlist.has(email)) {
      return {
        ok: false,
        status: 403,
        message: 'Email is not in admin allowlist.'
      };
    }

    return {
      ok: true,
      user: payload.user
    };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      message: error instanceof Error ? error.message : 'Unable to reach auth service.'
    };
  }
}
