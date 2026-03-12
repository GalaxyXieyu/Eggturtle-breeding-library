import { NextResponse } from 'next/server';
import { updateMyPasswordRequestSchema, updateMyPasswordResponseSchema } from '@eggturtle/shared/auth';

import {
  createStandardErrorResponse,
  invalidRequestResponse,
  parseErrorPayload,
  unauthorizedResponse,
} from '@/lib/api-error-response';
import {
  clearSessionCookie,
  getAdminApiBaseUrl,
  getSessionToken
} from '@/lib/server-session';

export async function PUT(request: Request) {
  const token = getSessionToken();

  if (!token) {
    return withClearedSessionCookie(unauthorizedResponse());
  }

  try {
    const payload = updateMyPasswordRequestSchema.parse(await request.json());
    const upstreamResponse = await fetch(`${getAdminApiBaseUrl()}/me/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    const body = await parseErrorPayload(upstreamResponse);

    if (!upstreamResponse.ok) {
      return withOptionalClearedSessionCookie(
        createStandardErrorResponse(upstreamResponse.status, body),
        upstreamResponse.status,
      );
    }

    return NextResponse.json(updateMyPasswordResponseSchema.parse(body));
  } catch {
    return invalidRequestResponse();
  }
}

function withClearedSessionCookie(response: NextResponse) {
  clearSessionCookie(response);
  return response;
}

function withOptionalClearedSessionCookie(response: NextResponse, status: number) {
  if (status === 401) {
    clearSessionCookie(response);
  }

  return response;
}

