import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  PublicCapabilityProofSection,
  PublicCapabilityShowcaseSection,
  PublicConversionSection,
  PublicQuickValueBar,
} from '@/app/public/_public-product/components';
import { mapTenantFeedToLegacy } from '@/app/public/_public-product/public-share-adapter';
import { resolvePublicSharePresentation } from '@/app/public/_public-product/presentation';
import PublicBottomDock from '@/app/public/_shared/public-bottom-dock';
import PublicFloatingActions from '@/app/public/_shared/public-floating-actions';
import { withPublicImageMaxEdge } from '@/app/public/_shared/public-image';
import PublicShareErrorPanel from '@/app/public/_shared/public-share-error-panel';
import {
  appendPublicShareQuery,
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  firstSearchParamValue,
  refreshPublicShareEntryLocation,
  shouldAutoRefreshShareSignature,
  type PublicSearchParams,
} from '@/app/public/_shared/public-share-api';

export default async function PublicShareSeriesPage({
  params,
  searchParams,
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
        title="功能页暂不可用"
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
          <h1>功能页暂不可用</h1>
          <p className="notice notice-warning">该链接不是用户图鉴分享链接。</p>
        </section>
      </main>
    );
  }

  const legacyData = mapTenantFeedToLegacy(shareResult.data);
  const seriesCounts = new Map<string, number>();
  for (const breeder of legacyData.breeders) {
    seriesCounts.set(breeder.seriesId, (seriesCounts.get(breeder.seriesId) ?? 0) + 1);
  }

  const shareRouteQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query);
  const currentSeriesId = firstSearchParamValue(searchParams.series)?.trim();
  if (currentSeriesId) {
    shareRouteQuery.set('series', currentSeriesId);
  }

  const shareQuery = shareRouteQuery.toString();
  const petsAllHref = appendPublicShareQuery(`/public/s/${params.shareToken}`, shareQuery);
  const onboardingHref = appendPublicShareQuery(`/public/s/${params.shareToken}/me#free-plan`, shareQuery);
  const presentation = resolvePublicSharePresentation(shareResult.data.presentation);
  const contactQrImageUrl = presentation.contact.showWechatBlock ? presentation.contact.wechatQrImageUrl : null;
  const contactWechatId = presentation.contact.showWechatBlock ? presentation.contact.wechatId : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 text-black dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900/40 dark:text-neutral-100">
      <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(env(safe-area-inset-bottom)+94px)] pt-[calc(env(safe-area-inset-top)+14px)] sm:px-5">
        <header className="rounded-3xl border border-black/10 bg-white/92 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.08)] backdrop-blur dark:border-white/10 dark:bg-neutral-900/75 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">
            Capabilities
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100 sm:text-[30px]">
            公开图鉴的功能亮点
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 sm:text-[15px]">
            “系列”已降为筛选项与兼容入口保留；这一页现在更适合用来展示这套公开图鉴真正能解决什么问题。
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={petsAllHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:border-[#FFD400] dark:bg-[#FFD400] dark:text-neutral-900 dark:hover:bg-[#f1ca00]"
            >
              返回宠物页
            </Link>
            <Link
              href={onboardingHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-neutral-900 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 dark:border-white/20 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              查看“我的”套餐
            </Link>
          </div>
        </header>

        <PublicQuickValueBar className="mt-4" />
        <PublicCapabilityShowcaseSection className="mt-4" />
        <PublicCapabilityProofSection className="mt-4" />

        {legacyData.series.length > 0 ? (
          <section className="mt-4 rounded-3xl border border-black/10 bg-white/92 p-5 shadow-[0_12px_28px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/75 sm:p-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-neutral-500 dark:text-neutral-400">
                Series Compatibility
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                系列兼容入口仍保留
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 sm:text-[15px]">
                如果你是从旧的 `/series` 链接进入，依然可以从这里按系列回到宠物页；只是“系列”不再作为一级主模块展示。
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {legacyData.series.map((series) => {
                const seriesHref = `/public/s/${params.shareToken}?${buildPetsQuery(shareRouteQuery, series.id).toString()}`;
                const isActive = currentSeriesId === series.id;
                return (
                  <Link
                    key={series.id}
                    href={seriesHref}
                    className={`inline-flex items-center rounded-full border px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'border-[#FFD400]/70 bg-[#FFF8D9] text-neutral-900 dark:border-[#FFD400]/45 dark:bg-[#2b2410]/70 dark:text-[#ffe8a6]'
                        : 'border-black/10 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-950/45 dark:text-neutral-200 dark:hover:bg-neutral-900'
                    }`}
                  >
                    {series.name}
                    <span className="ml-2 text-xs opacity-70">{seriesCounts.get(series.id) ?? 0} 只</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <PublicConversionSection
          className="mt-4"
          primaryHref={onboardingHref}
          primaryLabel="去“我的”看套餐"
          secondaryHref={petsAllHref}
          secondaryLabel="继续浏览宠物"
        />
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
