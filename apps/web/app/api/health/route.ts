import { NextResponse } from 'next/server';

import { ErrorCode, healthResponseSchema } from '@eggturtle/shared';

export async function GET() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:30011';

  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Upstream response status: ${response.status}`);
    }

    const data = await response.json();
    const parsed = healthResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new Error('Invalid health payload from API');
    }

    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json({
      status: 'degraded',
      service: 'web',
      timestamp: new Date().toISOString(),
      errorCode: ErrorCode.ApiUnavailable
    });
  }
}
