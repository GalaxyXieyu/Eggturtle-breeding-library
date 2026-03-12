import { NextResponse } from 'next/server';
import { requestCodeRequestSchema, requestCodeResponseSchema } from '@eggturtle/shared/auth';

import {
  createStandardErrorResponse,
  invalidRequestResponse,
  parseErrorPayload,
} from '@/lib/api-error-response';
import { getAdminApiBaseUrl } from '@/lib/server-session';

export async function POST(request: Request) {
  try {
    const payload = requestCodeRequestSchema.parse(await request.json());

    const upstreamResponse = await fetch(`${getAdminApiBaseUrl()}/auth/request-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-eggturtle-auth-surface': 'admin'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    const body = await parseErrorPayload(upstreamResponse);

    if (!upstreamResponse.ok) {
      return createStandardErrorResponse(upstreamResponse.status, body);
    }

    return NextResponse.json(requestCodeResponseSchema.parse(body));
  } catch {
    return invalidRequestResponse();
  }
}
