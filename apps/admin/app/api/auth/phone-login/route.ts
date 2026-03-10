import { NextResponse } from 'next/server';
import { phoneLoginRequestSchema, phoneLoginResponseSchema } from '@eggturtle/shared/auth';

import {
  applySessionCookie,
  clearSessionCookie,
  getAdminApiBaseUrl,
  resolveSessionFromToken
} from '@/lib/server-session';

export async function POST(request: Request) {
  try {
    const payload = phoneLoginRequestSchema.parse(await request.json());
    const upstreamResponse = await fetch(`${getAdminApiBaseUrl()}/auth/phone-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-eggturtle-auth-surface': 'admin'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    const body = await parseJsonBody(upstreamResponse);

    if (!upstreamResponse.ok) {
      return withClearedSessionCookie(
        NextResponse.json(
          {
            message: pickErrorMessage(body, `请求失败（${upstreamResponse.status}）`)
          },
          { status: upstreamResponse.status }
        )
      );
    }

    const { accessToken } = phoneLoginResponseSchema.parse(body);
    const session = await resolveSessionFromToken(accessToken);

    if (!session || !session.user.isSuperAdmin) {
      return withClearedSessionCookie(
        NextResponse.json(
          {
            message: '后台访问未授权。'
          },
          { status: 403 }
        )
      );
    }

    const response = NextResponse.json(session);
    applySessionCookie(response, accessToken);
    return response;
  } catch {
    return withClearedSessionCookie(
      NextResponse.json(
        {
          message: '请求参数无效。'
        },
        { status: 400 }
      )
    );
  }
}

function withClearedSessionCookie(response: NextResponse) {
  clearSessionCookie(response);
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
