import { ErrorCode } from '@eggturtle/shared';
import { passwordLoginRequestSchema, passwordLoginResponseSchema } from '@eggturtle/shared/auth';

import {
  createErrorResponse,
  createStandardErrorResponse,
  invalidRequestResponse,
  parseErrorPayload,
} from '@/lib/api-error-response';
import {
  applySessionCookie,
  clearSessionCookie,
  getAdminApiBaseUrl,
  resolveSessionFromToken
} from '@/lib/server-session';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const payload = passwordLoginRequestSchema.parse(await request.json());
    const upstreamResponse = await fetch(`${getAdminApiBaseUrl()}/auth/password-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-eggturtle-auth-surface': 'admin'
      },
      body: JSON.stringify({
        login: payload.login,
        password: payload.password
      }),
      cache: 'no-store'
    });

    const body = await parseErrorPayload(upstreamResponse);

    if (!upstreamResponse.ok) {
      return withClearedSessionCookie(createStandardErrorResponse(upstreamResponse.status, body));
    }

    const { accessToken } = passwordLoginResponseSchema.parse(body);
    const session = await resolveSessionFromToken(accessToken);

    if (!session || !session.user.isSuperAdmin) {
      return withClearedSessionCookie(createErrorResponse(403, ErrorCode.Forbidden, 'Forbidden.'));
    }

    const response = NextResponse.json(session);
    applySessionCookie(response, accessToken);
    return response;
  } catch {
    return withClearedSessionCookie(invalidRequestResponse());
  }
}

function withClearedSessionCookie(response: NextResponse) {
  clearSessionCookie(response);
  return response;
}
