const DEFAULT_API_BASE_URL = 'http://127.0.0.1:30011';
const PASSTHROUGH_HEADER_NAMES = ['cache-control', 'content-length', 'content-type', 'etag', 'last-modified'] as const;

function resolveInternalApiBaseUrl() {
  return process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export async function proxyPublicAsset(pathname: string, search = '') {
  const upstreamUrl = new URL(pathname, resolveInternalApiBaseUrl());
  if (search) {
    upstreamUrl.search = search;
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      cache: 'force-cache',
      next: { revalidate: 600 }
    });
    const headers = new Headers();

    for (const name of PASSTHROUGH_HEADER_NAMES) {
      const value = upstreamResponse.headers.get(name);
      if (value) {
        headers.set(name, value);
      }
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers
    });
  } catch {
    return Response.json({ message: 'Public asset proxy request failed.' }, { status: 502 });
  }
}
