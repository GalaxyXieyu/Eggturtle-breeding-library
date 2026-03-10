import { NextResponse } from 'next/server';
import { requestSmsCodeRequestSchema, requestSmsCodeResponseSchema } from '@eggturtle/shared/auth';

import { getAdminApiBaseUrl } from '@/lib/server-session';

export async function POST(request: Request) {
  try {
    const payload = requestSmsCodeRequestSchema.parse(await request.json());

    const upstreamResponse = await fetch(`${getAdminApiBaseUrl()}/auth/request-sms-code`, {
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
      return NextResponse.json(
        {
          message: pickErrorMessage(body, `请求失败（${upstreamResponse.status}）`)
        },
        { status: upstreamResponse.status }
      );
    }

    return NextResponse.json(requestSmsCodeResponseSchema.parse(body));
  } catch {
    return NextResponse.json(
      {
        message: '请求参数无效。'
      },
      { status: 400 }
    );
  }
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
