import { NextResponse } from 'next/server';

import { isSuperAdminEmailAllowlisted } from '../../../../lib/admin-auth';
import {
  clearSessionCookie,
  getSessionToken,
  resolveSessionFromToken
} from '../../../../lib/server-session';

export async function GET() {
  const token = getSessionToken();

  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const session = await resolveSessionFromToken(token);

  if (!session || !isSuperAdminEmailAllowlisted(session.user.email)) {
    const response = NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
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
