import { NextResponse } from 'next/server';

import { ADMIN_ACCESS_COOKIE_NAME, clearAdminSessionCookieOptions } from '../../../../lib/admin-auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_ACCESS_COOKIE_NAME, '', clearAdminSessionCookieOptions());
  return response;
}
