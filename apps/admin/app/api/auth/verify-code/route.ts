import { NextResponse } from 'next/server';
import { verifyCodeRequestSchema, verifyCodeResponseSchema } from '@eggturtle/shared/auth';

import {
  ADMIN_ACCESS_COOKIE_NAME,
  clearAdminSessionCookieOptions,
  getAdminSessionCookieOptions,
  getApiBaseUrl,
  validateAdminAccessToken
} from '../../../../lib/admin-auth';

export async function POST(request: Request) {
  try {
    const payload = verifyCodeRequestSchema.parse(await request.json());

    const upstreamResponse = await fetch(`${getApiBaseUrl()}/auth/verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    const body = await parseJsonBody(upstreamResponse);

    if (!upstreamResponse.ok) {
      return withClearedSessionCookie(
        NextResponse.json(
          {
            message: pickErrorMessage(body, `Request failed with status ${upstreamResponse.status}`)
          },
          { status: upstreamResponse.status }
        )
      );
    }

    const { accessToken } = verifyCodeResponseSchema.parse(body);
    const validationResult = await validateAdminAccessToken(accessToken);

    if (!validationResult.ok) {
      return withClearedSessionCookie(
        NextResponse.json(
          {
            message: validationResult.message
          },
          { status: validationResult.status }
        )
      );
    }

    const response = NextResponse.json({
      ok: true,
      user: validationResult.user
    });

    response.cookies.set(ADMIN_ACCESS_COOKIE_NAME, accessToken, getAdminSessionCookieOptions());

    return response;
  } catch {
    return withClearedSessionCookie(
      NextResponse.json(
        {
          message: 'Invalid request payload.'
        },
        { status: 400 }
      )
    );
  }
}

function withClearedSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_ACCESS_COOKIE_NAME, '', clearAdminSessionCookieOptions());
  return response;
}

async function parseJsonBody(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function pickErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  if ('error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  return fallback;
}
