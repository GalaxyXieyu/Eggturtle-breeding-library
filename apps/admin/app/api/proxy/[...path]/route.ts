import { ErrorCode } from '@eggturtle/shared';
import { NextRequest, NextResponse } from 'next/server';

import { createErrorResponse, unavailableResponse } from '@/lib/api-error-response';
import {
  ADMIN_ACCESS_COOKIE_NAME,
  clearAdminSessionCookieOptions,
  getApiBaseUrl,
  validateAdminAccessToken
} from '@/lib/admin-auth';

type RouteContext = {
  params: {
    path: string[];
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  return handleProxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleProxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleProxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleProxyRequest(request, context);
}

async function handleProxyRequest(request: NextRequest, context: RouteContext) {
  const token = request.cookies.get(ADMIN_ACCESS_COOKIE_NAME)?.value;

  if (!token) {
    return clearCookie(createErrorResponse(401, ErrorCode.Unauthorized, 'Unauthorized.'));
  }

  const validationResult = await validateAdminAccessToken(token);

  if (!validationResult.ok) {
    return clearCookie(
      createErrorResponse(
        validationResult.status === 403 ? 403 : validationResult.status === 503 ? 503 : 401,
        validationResult.errorCode,
        validationResult.message,
      ),
    );
  }

  const [firstSegment] = context.params.path;

  if (firstSegment !== 'admin') {
    return createErrorResponse(404, null, 'Not found.');
  }

  const upstreamPath = context.params.path.join('/');
  const upstreamUrl = `${getApiBaseUrl()}/${upstreamPath}${request.nextUrl.search}`;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');

  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  headers.set('Authorization', `Bearer ${token}`);

  const requestBody = hasRequestBody(request.method) ? await request.text() : undefined;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: requestBody,
      cache: 'no-store'
    });

    const responseBody = await upstreamResponse.text();
    const response = new NextResponse(responseBody, {
      status: upstreamResponse.status
    });

    const responseContentType = upstreamResponse.headers.get('content-type');
    if (responseContentType) {
      response.headers.set('Content-Type', responseContentType);
    }

    if (upstreamResponse.status === 401) {
      response.cookies.set(ADMIN_ACCESS_COOKIE_NAME, '', clearAdminSessionCookieOptions());
    }

    return response;
  } catch {
    return unavailableResponse();
  }
}

function clearCookie(response: NextResponse) {
  response.cookies.set(ADMIN_ACCESS_COOKIE_NAME, '', clearAdminSessionCookieOptions());
  return response;
}

function hasRequestBody(method: string) {
  return !['GET', 'HEAD'].includes(method.toUpperCase());
}
