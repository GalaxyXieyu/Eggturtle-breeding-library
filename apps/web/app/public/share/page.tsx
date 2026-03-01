import { publicShareResponseSchema } from '@eggturtle/shared';

import { fetchPublicShareFromSearchParams, type PublicSearchParams } from '../_shared/public-share-api';

export default async function PublicSharePage({
  searchParams
}: {
  searchParams: PublicSearchParams;
}) {
  const isDemo = searchParams.demo === '1';
  const shareResult = isDemo ? demoShareResult() : await fetchPublicShareFromSearchParams(searchParams);

  if (!shareResult.ok) {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>分享页不可用</h1>
          <p className="notice notice-error">{shareResult.message}</p>
        </section>
      </main>
    );
  }

  if (shareResult.data.resourceType !== 'product') {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>分享页不可用</h1>
          <p className="notice notice-warning">该链接属于租户图鉴分享，请从入口链接重新打开。</p>
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

type ShareData = ReturnType<typeof publicShareResponseSchema.parse>;

type ShareResult =
  | {
      ok: true;
      data: ShareData;
    }
  | {
      ok: false;
      message: string;
    };

function demoShareResult(): ShareResult {
  return {
    ok: true,
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
