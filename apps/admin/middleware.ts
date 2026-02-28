import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE_NAME } from './lib/session-constants';

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*']
};
