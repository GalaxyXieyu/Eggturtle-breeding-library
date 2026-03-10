import { NextResponse } from 'next/server';
import { updateMyPasswordRequestSchema, updateMyPasswordResponseSchema } from '@eggturtle/shared/auth';

import {
  clearSessionCookie,
  getAdminApiBaseUrl,
  getSessionToken
} from '@/lib/server-session';

export async function PUT(request: Request) {
  const token = getSessionToken();

  if (!token) {
    return withClearedSessionCookie(NextResponse.json({ message: '未登录' }, { status: 401 }));
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

    const body = await parseJsonBody(upstreamResponse);

    if (!upstreamResponse.ok) {
      return withOptionalClearedSessionCookie(
        NextResponse.json(
          {
            message: pickErrorMessage(body, `请求失败（${upstreamResponse.status}）`)
          },
          { status: upstreamResponse.status }
        ),
        upstreamResponse.status
      );
    }

    return NextResponse.json(updateMyPasswordResponseSchema.parse(body));
  } catch {
    return NextResponse.json(
      {
        message: '请求参数无效。'
      },
      { status: 400 }
    );
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
