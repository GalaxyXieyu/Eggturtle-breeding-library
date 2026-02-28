import { NextResponse } from 'next/server';
import { requestCodeRequestSchema, requestCodeResponseSchema } from '@eggturtle/shared/auth';

import { isSuperAdminEmailAllowlisted } from '../../../../lib/admin-auth';
import { getAdminApiBaseUrl } from '../../../../lib/server-session';

export async function POST(request: Request) {
  try {
    const payload = requestCodeRequestSchema.parse(await request.json());

    if (!isSuperAdminEmailAllowlisted(payload.email)) {
      return NextResponse.json(
        {
          message: '该账号不在后台白名单中。'
        },
        { status: 403 }
      );
    }

    const upstreamResponse = await fetch(`${getAdminApiBaseUrl()}/auth/request-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    const body = await parseJsonBody(upstreamResponse);

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          message: pickErrorMessage(body, `Request failed with status ${upstreamResponse.status}`)
        },
        { status: upstreamResponse.status }
      );
    }

    return NextResponse.json(requestCodeResponseSchema.parse(body));
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
