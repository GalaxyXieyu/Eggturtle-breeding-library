import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:30011';

type RouteContext = {
  params: {
    path?: string[];
  };
};

function resolveInternalApiBaseUrl() {
  return process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function hasRequestBody(method: string) {
  return !['GET', 'HEAD'].includes(method.toUpperCase());
}

async function handleProxyRequest(request: NextRequest, context: RouteContext) {
  const path = context.params.path?.join('/');
  if (!path) {
    return NextResponse.json({ message: 'Proxy path is required.' }, { status: 400 });
  }

  const upstreamUrl = `${resolveInternalApiBaseUrl()}/${path}${request.nextUrl.search}`;
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const authorization = request.headers.get('authorization');

  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  if (authorization) {
    headers.set('Authorization', authorization);
  }

  const body = hasRequestBody(request.method) ? Buffer.from(await request.arrayBuffer()) : undefined;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: hasRequestBody(request.method) ? body : undefined,
      cache: 'no-store'
    });

    const responseBody = await upstreamResponse.arrayBuffer();
    const response = new NextResponse(responseBody, {
      status: upstreamResponse.status
    });

    const responseContentType = upstreamResponse.headers.get('content-type');
    if (responseContentType) {
      response.headers.set('Content-Type', responseContentType);
    }

    return response;
  } catch {
    return NextResponse.json({ message: 'API proxy request failed.' }, { status: 502 });
  }
}

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
