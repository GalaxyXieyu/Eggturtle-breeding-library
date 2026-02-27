import { NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_ACCESS_COOKIE_NAME,
  clearAdminSessionCookieOptions,
  getApiBaseUrl,
  validateAdminAccessToken
} from '../../../../lib/admin-auth';

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
    return clearCookie(
      NextResponse.json(
        {
          message: 'Missing admin session.'
        },
        { status: 401 }
      )
    );
  }

  const validationResult = await validateAdminAccessToken(token);

  if (!validationResult.ok) {
    return clearCookie(
      NextResponse.json(
        {
          message: validationResult.status === 403 ? 'Admin access denied.' : 'Invalid admin session.'
        },
        { status: validationResult.status === 403 ? 403 : 401 }
      )
    );
  }

  const [firstSegment] = context.params.path;

  if (firstSegment !== 'admin') {
    return NextResponse.json(
      {
        message: 'Not found.'
      },
      { status: 404 }
    );
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
}

function clearCookie(response: NextResponse) {
  response.cookies.set(ADMIN_ACCESS_COOKIE_NAME, '', clearAdminSessionCookieOptions());
  return response;
}

function hasRequestBody(method: string) {
  return !['GET', 'HEAD'].includes(method.toUpperCase());
}
