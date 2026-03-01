import { publicShareQuerySchema, publicShareResponseSchema } from '@eggturtle/shared';

type SearchParams = Record<string, string | string[] | undefined>;

const DEFAULT_API_BASE_URL = 'http://localhost:30011';

export default async function PublicSharePage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const isDemo = firstValue(searchParams.demo) === '1';
  const sid = firstValue(searchParams.sid);

  if (!sid && !isDemo) {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>分享页不可用</h1>
          <p className="notice notice-error">缺少分享标识参数（sid）。</p>
        </section>
      </main>
    );
  }

  const shareResult = isDemo ? demoShareResult() : await fetchPublicShareFromQuery(searchParams, sid as string);

  if (!shareResult.success) {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>分享页不可用</h1>
          <p className="notice notice-error">{shareResult.message}</p>
        </section>
      </main>
    );
  }

  const { tenant, product } = shareResult.data;

  return (
    <main className="share-shell">
      <section className="card share-hero stack">
        <p className="share-kicker">TurtleAlbum · Public Share</p>
        <h1>{product.name || product.code}</h1>
        <p className="muted">
          由租户 <strong>{tenant.name}</strong>（{tenant.slug}）分享
        </p>
      </section>

      <section className="card panel stack">
        <h2>产品信息</h2>
        <div className="kv-grid">
          {product.name ? (
            <p>
              <span className="muted">名称</span>
              <strong>{product.name}</strong>
            </p>
          ) : null}
          <p>
            <span className="muted">Code</span>
            <strong>{product.code}</strong>
          </p>
          <p>
            <span className="muted">描述</span>
            <strong>{product.description ?? '暂无描述'}</strong>
          </p>
        </div>
      </section>

      <section className="card panel stack">
        <h2>图片</h2>
        {product.images.length === 0 ? <p className="notice notice-warning">该产品暂无图片。</p> : null}
        {product.images.length > 0 ? (
          <div className="share-image-grid">
            {product.images.map((image) => (
              <figure key={image.id} className="share-image-card">
                <img src={image.url} alt={product.name ?? product.code} />
                <figcaption>{image.isMain ? '主图' : '图片'} #{image.sortOrder + 1}</figcaption>
              </figure>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

async function fetchPublicShareFromQuery(searchParams: SearchParams, sid: string): Promise<ShareResult> {
  const parsedQuery = publicShareQuerySchema.safeParse({
    tenantId: firstValue(searchParams.tenantId),
    resourceType: firstValue(searchParams.resourceType),
    resourceId: firstValue(searchParams.resourceId),
    exp: firstValue(searchParams.exp),
    sig: firstValue(searchParams.sig)
  });

  if (!parsedQuery.success) {
    return {
      success: false,
      message: '分享链接无效或已过期。'
    };
  }

  return fetchPublicShare(sid, parsedQuery.data);
}

type ShareData = ReturnType<typeof publicShareResponseSchema.parse>;

type ShareResult =
  | {
      success: true;
      data: ShareData;
    }
  | {
      success: false;
      message: string;
    };

function demoShareResult(): ShareResult {
  return {
    success: true,
    data: {
      shareId: 'share_demo',
      resourceType: 'product',
      tenant: {
        id: 'tenant_demo',
        slug: 'demo-tenant',
        name: '演示租户'
      },
      product: {
        id: 'product_demo',
        tenantId: 'tenant_demo',
        code: 'ET-2026-0001',
        name: '红系观赏龟苗',
        description: '体态匀称，花纹清晰，适合精品龟苗展示。',
        images: [
          {
            id: 'img_demo_1',
            tenantId: 'tenant_demo',
            productId: 'product_demo',
            key: 'demo/main.jpg',
            url: 'https://picsum.photos/id/1062/1200/800',
            contentType: 'image/jpeg',
            isMain: true,
            sortOrder: 0
          },
          {
            id: 'img_demo_2',
            tenantId: 'tenant_demo',
            productId: 'product_demo',
            key: 'demo/2.jpg',
            url: 'https://picsum.photos/id/237/1200/800',
            contentType: 'image/jpeg',
            isMain: false,
            sortOrder: 1
          }
        ]
      },
      expiresAt: '2099-01-01T00:00:00.000Z'
    }
  };
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
): Promise<ShareResult> {
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
      message: '分享接口返回结构异常。'
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
    return '该分享链接已过期，请重新生成。';
  }

  if (status === 404) {
    return '未找到分享内容。';
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
