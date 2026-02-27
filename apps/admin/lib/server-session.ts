import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { meResponseSchema, type MeResponse } from '@eggturtle/shared';

import { ADMIN_SESSION_COOKIE_NAME, DEFAULT_ADMIN_API_BASE_URL } from './session-constants';

export { ADMIN_SESSION_COOKIE_NAME } from './session-constants';

export function getAdminApiBaseUrl() {
  return (
    process.env.ADMIN_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_ADMIN_API_BASE_URL
  );
}

export function getSessionToken() {
  return cookies().get(ADMIN_SESSION_COOKIE_NAME)?.value ?? null;
}

export function applySessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0)
  });
}

export async function resolveSessionFromToken(token: string): Promise<MeResponse | null> {
  const response = await fetch(`${getAdminApiBaseUrl()}/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return meResponseSchema.parse(payload);
}
