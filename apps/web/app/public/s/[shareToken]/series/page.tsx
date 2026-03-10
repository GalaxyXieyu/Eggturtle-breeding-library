import Link from 'next/link';
import { redirect } from 'next/navigation';

import { mapTenantFeedToLegacy } from '@/app/public/_public-product/public-share-adapter';
import PublicBottomDock from '@/app/public/_shared/public-bottom-dock';
import PublicFloatingActions from '@/app/public/_shared/public-floating-actions';
import PublicShareErrorPanel from '@/app/public/_shared/public-share-error-panel';
import {
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  firstSearchParamValue,
  refreshPublicShareEntryLocation,
  shouldAutoRefreshShareSignature,
  type PublicSearchParams
} from '@/app/public/_shared/public-share-api';
import { withPublicImageMaxEdge } from '@/app/public/_shared/public-image';
import SeriesCoverImage from './SeriesCoverImage';

export default async function PublicShareSeriesPage({
  params,
  searchParams
}: {
  params: { shareToken: string };
  searchParams: PublicSearchParams;
}) {
  const sidValue = firstSearchParamValue(searchParams.sid);
  const hasSidParam = typeof sidValue === 'string' && sidValue.trim().length > 0;
  if (!hasSidParam) {
    const location = await refreshPublicShareEntryLocation(params.shareToken);
    if (location) {
      redirect(location);
    }
  }

  const shareResult = await fetchPublicShareFromSearchParams(searchParams);

  if (!shareResult.ok) {
    if (shouldAutoRefreshShareSignature(shareResult.status, shareResult.errorCode)) {
      const location = await refreshPublicShareEntryLocation(params.shareToken);
      if (location) {
        redirect(location);
      }
    }

    return (
      <PublicShareErrorPanel
        title="系列页暂不可用"
        message={shareResult.message}
        shareToken={params.shareToken}
        canAutoRefresh={false}
      />
    );
  }

  if (shareResult.data.resourceType !== 'tenant_feed') {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>系列页暂不可用</h1>
          <p className="notice notice-warning">该链接不是用户图鉴分享链接。</p>
        </section>
      </main>
    );
  }

  const legacyData = mapTenantFeedToLegacy(shareResult.data);
  const seriesCounts = new Map<string, number>();
  const seriesCoverMap = new Map<string, string>();
  for (const breeder of legacyData.breeders) {
    seriesCounts.set(breeder.seriesId, (seriesCounts.get(breeder.seriesId) ?? 0) + 1);
    if (!seriesCoverMap.has(breeder.seriesId)) {
      const firstImage = breeder.images[0]?.url;
      if (firstImage) {
        seriesCoverMap.set(breeder.seriesId, firstImage);
      }
    }
  }

  const shareRouteQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query);
  const currentSeriesId = firstSearchParamValue(searchParams.series)?.trim();
  if (currentSeriesId) {
    shareRouteQuery.set('series', currentSeriesId);
  }

  const shareQuery = shareRouteQuery.toString();
  const petsAllHref = `/public/s/${params.shareToken}?${buildPetsQuery(shareRouteQuery).toString()}`;
  const presentation = shareResult.data.presentation;
  const contactQrImageUrl = presentation.contact.showWechatBlock ? presentation.contact.wechatQrImageUrl : null;
  const contactWechatId = presentation.contact.showWechatBlock ? presentation.contact.wechatId : null;

  return (
    <div className="public-bg-page public-text-primary min-h-screen">
      <main className="mx-auto w-full max-w-4xl px-4 pb-[calc(env(safe-area-inset-bottom)+94px)] pt-[calc(env(safe-area-inset-top)+14px)] sm:px-5">
        <header className="public-bg-card public-border-default rounded-3xl border p-5 shadow-[0_14px_32px_rgba(0,0,0,0.08)] backdrop-blur">
          <p className="public-text-subtle text-xs uppercase tracking-[0.28em]">Series</p>
          <h1 className="public-text-primary mt-2 text-2xl font-semibold">按系列浏览宠物</h1>
          <p className="public-text-muted mt-2 text-sm leading-relaxed">
            共 {legacyData.series.length} 个系列，点击系列即可回到宠物页并带上筛选条件。
          </p>
          <Link
            href={petsAllHref}
            className="public-btn-secondary mt-3"
          >
            查看全部宠物
          </Link>
        </header>

        {legacyData.series.length === 0 ? (
          <section className="public-bg-card public-border-default public-text-muted mt-4 rounded-3xl border p-5 text-sm shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
            当前分享还没有可浏览的系列。
          </section>
        ) : (
          <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {legacyData.series.map((series) => {
              const petsQuery = buildPetsQuery(shareRouteQuery, series.id).toString();
              const petsHref = `/public/s/${params.shareToken}?${petsQuery}`;
              const isActive = currentSeriesId === series.id;
              const coverUrl = seriesCoverMap.get(series.id);
              return (
                <article
                  key={series.id}
                  className={`public-border-subtle group overflow-hidden rounded-2xl border bg-gradient-to-b from-white via-white to-neutral-50 shadow-[0_12px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.12)] dark:from-neutral-900/75 dark:via-neutral-900/75 dark:to-neutral-900/60 ${
                    isActive ? 'ring-2 ring-[#FFD400]/65' : ''
                  }`}
                >
                  <div className="relative h-40 w-full">
                    {coverUrl ? (
                      <SeriesCoverImage
                        coverUrl={withPublicImageMaxEdge(coverUrl, 320) ?? coverUrl}
                        seriesName={series.name}
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
                    <div className="absolute bottom-3 left-4 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">系列封面</div>
                  </div>

                  <div className="bg-white/95 p-4 dark:bg-neutral-900/75">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="public-text-primary truncate text-[15px] font-semibold tracking-tight">{series.name}</p>
                        <p className="public-text-muted truncate text-sm">{series.code || '系列'}</p>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-300">在库 {seriesCounts.get(series.id) ?? 0}</span>
                    </div>
                    <p className="public-text-secondary mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed">{series.description || '暂无描述'}</p>
                    <div className="mt-3 flex items-center justify-end">
                      <Link
                        href={petsHref}
                        className="inline-flex rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800 dark:bg-[#FFD400] dark:text-neutral-900 dark:hover:bg-[#f1ca00]"
                      >
                        查看该系列宠物
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      <PublicFloatingActions
        useCurrentUrl
        showHomeButton={false}
        tenantQrImageUrl={contactQrImageUrl}
        tenantWechatId={contactWechatId}
        shareCardTitle={presentation.feedTitle}
        shareCardSubtitle={presentation.feedSubtitle}
        shareCardPrimaryColor={presentation.theme.brandPrimary}
        shareCardSecondaryColor={presentation.theme.brandSecondary}
        shareCardHeroImageUrl={withPublicImageMaxEdge(presentation.hero.images[0], 960) ?? null}
      />
      <PublicBottomDock shareToken={params.shareToken} shareQuery={shareQuery} activeTab="series" />
    </div>
  );
}

function buildPetsQuery(authQuery: URLSearchParams, seriesId?: string): URLSearchParams {
  const params = new URLSearchParams(authQuery.toString());
  if (seriesId) {
    params.set('series', seriesId);
  } else {
    params.delete('series');
  }
  return params;
}
