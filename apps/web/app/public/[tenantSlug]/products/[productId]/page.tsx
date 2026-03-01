import Link from 'next/link';

import {
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  type PublicSearchParams
} from '../../../_shared/public-share-api';

export default async function TenantPublicDetailPage({
  params,
  searchParams
}: {
  params: { tenantSlug: string; productId: string };
  searchParams: PublicSearchParams;
}) {
  const shareResult = await fetchPublicShareFromSearchParams(searchParams, {
    productId: params.productId
  });

  if (!shareResult.ok) {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>公开详情不可用</h1>
          <p className="notice notice-error">{shareResult.message}</p>
        </section>
      </main>
    );
  }

  if (shareResult.data.resourceType !== 'tenant_feed') {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>公开详情不可用</h1>
          <p className="notice notice-warning">该链接不是租户图鉴分享链接。</p>
        </section>
      </main>
    );
  }

  if (!shareResult.data.product) {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>公开详情不可用</h1>
          <p className="notice notice-warning">未找到该产品，或该产品不在分享租户中。</p>
        </section>
      </main>
    );
  }

  const { tenant, product } = shareResult.data;
  const routeQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query).toString();
  const feedHref = `/public/${encodeURIComponent(tenant.slug)}?${routeQuery}`;

  return (
    <main className="share-shell">
      <section className="card share-hero stack">
        <p className="share-kicker">TurtleAlbum · Public Detail</p>
        <h1>{product.name || product.code}</h1>
        <p className="muted">
          租户 <strong>{tenant.name}</strong>（{tenant.slug}）
        </p>
        <div className="row">
          <Link href={feedHref} className="secondary">
            返回图鉴列表
          </Link>
        </div>
      </section>

      <section className="card panel stack">
        <h2>基础信息</h2>
        <div className="kv-grid">
          <p>
            <span className="muted">Code</span>
            <strong>{product.code}</strong>
          </p>
          {product.name ? (
            <p>
              <span className="muted">名称</span>
              <strong>{product.name}</strong>
            </p>
          ) : null}
          <p>
            <span className="muted">性别</span>
            <strong>{formatSex(product.sex)}</strong>
          </p>
          <p>
            <span className="muted">系列</span>
            <strong>{product.seriesId ?? '-'}</strong>
          </p>
          <p>
            <span className="muted">子代单价</span>
            <strong>
              {typeof product.offspringUnitPrice === 'number'
                ? `¥ ${formatPrice(product.offspringUnitPrice)}`
                : '-'}
            </strong>
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

function formatSex(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  if (value === 'male') {
    return '公';
  }

  if (value === 'female') {
    return '母';
  }

  return value;
}

function formatPrice(value: number) {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}
