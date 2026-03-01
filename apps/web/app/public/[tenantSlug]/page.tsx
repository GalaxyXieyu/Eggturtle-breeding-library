import Link from 'next/link';

import {
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  type PublicSearchParams
} from '../_shared/public-share-api';

export default async function TenantPublicFeedPage({
  searchParams
}: {
  params: { tenantSlug: string };
  searchParams: PublicSearchParams;
}) {
  const shareResult = await fetchPublicShareFromSearchParams(searchParams);

  if (!shareResult.ok) {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>公开图鉴不可用</h1>
          <p className="notice notice-error">{shareResult.message}</p>
        </section>
      </main>
    );
  }

  if (shareResult.data.resourceType !== 'tenant_feed') {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>公开图鉴不可用</h1>
          <p className="notice notice-warning">该链接不是租户图鉴分享链接。</p>
        </section>
      </main>
    );
  }

  const { tenant, items, presentation } = shareResult.data;
  const routeQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query).toString();

  return (
    <main className="share-shell">
      <section className="card share-hero stack">
        <div className="relative overflow-hidden rounded-2xl">
          <img
            src={presentation.hero.images[0] || '/images/mg_04.jpg'}
            alt={presentation.feedTitle}
            className="h-44 w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/15 to-black/55" />
          <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
            <p className="share-kicker text-white/75">Public Feed</p>
            <h1>{presentation.feedTitle}</h1>
            <p className="text-sm text-white/85">{presentation.feedSubtitle}</p>
          </div>
        </div>
        <p className="muted">
          {tenant.slug} · 共 {items.length} 个在库个体
        </p>
      </section>

      {items.length === 0 ? (
        <section className="card panel stack">
          <p className="notice notice-warning">当前租户还没有可展示的产品。</p>
        </section>
      ) : (
        <section className="public-feed-waterfall">
          {items.map((item) => {
            const detailHref = `/public/${encodeURIComponent(tenant.slug)}/products/${item.id}?${routeQuery}`;

            return (
              <Link key={item.id} href={detailHref} className="public-feed-card">
                {item.coverImageUrl ? (
                  <img src={item.coverImageUrl} alt={item.name ?? item.code} className="public-feed-cover" />
                ) : (
                  <div className="public-feed-cover public-feed-cover-empty">暂无封面</div>
                )}
                <div className="public-feed-body stack">
                  <h2>{item.name || item.code}</h2>
                  <p className="muted mono">{item.code}</p>
                  <div className="row">
                    {item.sex ? <span className="public-feed-tag">{formatSex(item.sex)}</span> : null}
                    {item.seriesId ? <span className="public-feed-tag">系列 {item.seriesId}</span> : null}
                    {item.isFeatured ? <span className="public-feed-tag public-feed-tag-featured">精选</span> : null}
                  </div>
                  {item.offspringUnitPrice !== null ? (
                    <p className="public-feed-price">¥ {formatPrice(item.offspringUnitPrice)}</p>
                  ) : null}
                  {item.description ? <p className="muted">{item.description}</p> : null}
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {presentation.contact.showWechatBlock &&
      (presentation.contact.wechatQrImageUrl || presentation.contact.wechatId) ? (
        <section className="card panel stack">
          <h2>微信联系</h2>
          <div className="row">
            {presentation.contact.wechatQrImageUrl ? (
              <img
                src={presentation.contact.wechatQrImageUrl}
                alt="微信二维码"
                className="h-28 w-28 rounded-xl border border-neutral-200 bg-white object-cover p-1"
              />
            ) : null}
            {presentation.contact.wechatId ? (
              <p className="muted">
                微信号：<strong>{presentation.contact.wechatId}</strong>
              </p>
            ) : (
              <p className="muted">请扫码添加微信咨询。</p>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function formatSex(value: string) {
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
