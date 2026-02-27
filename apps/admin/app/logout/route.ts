import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_ACCESS_COOKIE_NAME, clearAdminSessionCookieOptions } from '../../lib/admin-auth';

export async function GET(request: NextRequest) {
  const redirectUrl = new URL('/login', request.url);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set(ADMIN_ACCESS_COOKIE_NAME, '', clearAdminSessionCookieOptions());

  return response;
}
