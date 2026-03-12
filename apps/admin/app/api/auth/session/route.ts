import { NextResponse } from 'next/server';

import { unauthorizedResponse } from '@/lib/api-error-response';
import {
  clearSessionCookie,
  getSessionToken,
  resolveSessionFromToken
} from '@/lib/server-session';

export async function GET() {
  const token = getSessionToken();

  if (!token) {
    return unauthorizedResponse();
  }

  const session = await resolveSessionFromToken(token);

  if (!session || !session.user.isSuperAdmin) {
    const response = unauthorizedResponse();
    clearSessionCookie(response);
    return response;
  }

  return NextResponse.json(session);
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
