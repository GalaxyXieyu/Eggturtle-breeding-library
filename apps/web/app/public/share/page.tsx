import { publicShareQuerySchema, publicShareResponseSchema } from '@eggturtle/shared';

type SearchParams = Record<string, string | string[] | undefined>;

const DEFAULT_API_BASE_URL = 'http://localhost:30011';

export default async function PublicSharePage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sid = firstValue(searchParams.sid);

  if (!sid) {
    return (
      <main>
        <h1>Shared page unavailable</h1>
        <p className="error">Missing share identifier.</p>
      </main>
    );
  }

  const parsedQuery = publicShareQuerySchema.safeParse({
    tenantId: firstValue(searchParams.tenantId),
    resourceType: firstValue(searchParams.resourceType),
    resourceId: firstValue(searchParams.resourceId),
    exp: firstValue(searchParams.exp),
    sig: firstValue(searchParams.sig)
  });

  if (!parsedQuery.success) {
    return (
      <main>
        <h1>Shared page unavailable</h1>
        <p className="error">Share link is invalid or expired.</p>
      </main>
    );
  }

  const shareResult = await fetchPublicShare(sid, parsedQuery.data);

  if (!shareResult.success) {
    return (
      <main>
        <h1>Shared page unavailable</h1>
        <p className="error">{shareResult.message}</p>
      </main>
    );
  }

  const { tenant, product, expiresAt } = shareResult.data;

  return (
    <main>
      <h1>{product.name || product.code}</h1>
      <p>
        Shared by tenant <strong>{tenant.name}</strong> ({tenant.slug})
      </p>
      <p>Share token expires at: {new Date(expiresAt).toLocaleString()}</p>

      <section className="card stack">
        <h2>Product details</h2>
        <p>
          <strong>Code:</strong> {product.code}
        </p>
        <p>
          <strong>ID:</strong> {product.id}
        </p>
        <p>
          <strong>Description:</strong> {product.description ?? 'No description'}
        </p>
      </section>

      <section className="card stack">
        <h2>Images</h2>
        {product.images.length === 0 ? <p>No images uploaded.</p> : null}
        <div className="stack">
          {product.images.map((image) => (
            <figure key={image.id} className="stack">
              <img src={image.url} alt={product.name ?? product.code} style={{ width: '100%', borderRadius: 8 }} />
              <figcaption>
                {image.isMain ? 'Main image' : 'Image'} #{image.sortOrder + 1}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}

async function fetchPublicShare(
  shareId: string,
  query: {
    tenantId: string;
    resourceType: 'product';
    resourceId: string;
    exp: string;
    sig: string;
  }
): Promise<
  | {
      success: true;
      data: ReturnType<typeof publicShareResponseSchema.parse>;
    }
  | {
      success: false;
      message: string;
    }
> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const requestUrl = new URL(`/shares/${shareId}/public`, apiBaseUrl);
  requestUrl.searchParams.set('tenantId', query.tenantId);
  requestUrl.searchParams.set('resourceType', query.resourceType);
  requestUrl.searchParams.set('resourceId', query.resourceId);
  requestUrl.searchParams.set('exp', query.exp);
  requestUrl.searchParams.set('sig', query.sig);

  const response = await fetch(requestUrl.toString(), {
    cache: 'no-store'
  });

  const payload = await safeJson(response);

  if (!response.ok) {
    return {
      success: false,
      message: pickErrorMessage(payload, response.status)
    };
  }

  const parsed = publicShareResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Unexpected response for public share page.'
    };
  }

  return {
    success: true,
    data: parsed.data
  };
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      message: text
    };
  }
}

function pickErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  if (status === 401) {
    return 'This share link has expired. Please ask for a fresh share link.';
  }

  if (status === 404) {
    return 'Share content not found.';
  }

  return `Request failed with status ${status}`;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}
