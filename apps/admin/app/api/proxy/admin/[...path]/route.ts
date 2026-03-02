import { NextRequest, NextResponse } from 'next/server';

import {
  clearSessionCookie,
  getAdminApiBaseUrl,
  getSessionToken
} from '../../../../../lib/server-session';

type RouteContext = {
  params: {
    path?: string[];
  };
};

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const token = getSessionToken();
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const path = context.params.path?.join('/');
  if (!path) {
    return NextResponse.json({ message: 'Admin proxy path is required.' }, { status: 400 });
  }

  const url = `${getAdminApiBaseUrl()}/admin/${path}${request.nextUrl.search}`;

  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  const hasBody = !['GET', 'HEAD'].includes(request.method.toUpperCase());
  const body = hasBody ? await request.text() : undefined;

  try {
    const upstreamResponse = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? body : undefined,
      cache: 'no-store'
    });

    const responseBody = await upstreamResponse.text();
    const responseHeaders: Record<string, string> = {
      'Content-Type': upstreamResponse.headers.get('Content-Type') ?? 'application/json'
    };

    const contentDisposition = upstreamResponse.headers.get('Content-Disposition');
    if (contentDisposition) {
      responseHeaders['Content-Disposition'] = contentDisposition;
    }

    const exportRowCount = upstreamResponse.headers.get('X-Export-Row-Count');
    if (exportRowCount) {
      responseHeaders['X-Export-Row-Count'] = exportRowCount;
    }

    const exportTruncated = upstreamResponse.headers.get('X-Export-Truncated');
    if (exportTruncated) {
      responseHeaders['X-Export-Truncated'] = exportTruncated;
    }

    const response = new NextResponse(responseBody, {
      status: upstreamResponse.status,
      headers: responseHeaders
    });

    if (upstreamResponse.status === 401) {
      clearSessionCookie(response);
    }

    return response;
  } catch {
    return NextResponse.json({ message: 'Admin API proxy request failed.' }, { status: 502 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}
