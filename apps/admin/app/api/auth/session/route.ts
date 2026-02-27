import { NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_ACCESS_COOKIE_NAME,
  clearAdminSessionCookieOptions,
  validateAdminAccessToken
} from '../../../../lib/admin-auth';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_ACCESS_COOKIE_NAME)?.value;

  if (!token) {
    return clearCookie(
      NextResponse.json(
        {
          message: 'Missing admin session.'
        },
        { status: 401 }
      )
    );
  }

  const validationResult = await validateAdminAccessToken(token);

  if (!validationResult.ok) {
    return clearCookie(
      NextResponse.json(
        {
          message: validationResult.message
        },
        { status: validationResult.status }
      )
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: validationResult.user
  });
}

function clearCookie(response: NextResponse) {
  response.cookies.set(ADMIN_ACCESS_COOKIE_NAME, '', clearAdminSessionCookieOptions());
  return response;
}
