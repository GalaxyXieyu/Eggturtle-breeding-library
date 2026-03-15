import { redirect } from 'next/navigation';

import PublicFeedPage from '@/app/public/_public-product/public-feed-page';
import { mapTenantFeedToLegacy } from '@/app/public/_public-product/public-share-adapter';
import PublicShareErrorPanel from '@/app/public/_shared/public-share-error-panel';
import {
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  firstSearchParamValue,
  refreshPublicShareEntryLocation,
  shouldAutoRefreshShareSignature,
  type PublicSearchParams,
} from '@/app/public/_shared/public-share-api';

export default async function PublicShareFeedPage({
  params,
  searchParams,
}: {
  params: { shareToken: string };
  searchParams: PublicSearchParams;
}) {
  const sidValue = firstSearchParamValue(searchParams.sid);
  const hasSidParam = typeof sidValue === 'string' && sidValue.trim().length > 0;
  const requestedTab = firstSearchParamValue(searchParams.tab)?.trim();
  const requestedSeriesId = firstSearchParamValue(searchParams.series)?.trim();
  const standaloneTab =
    requestedTab === 'features' || requestedTab === 'me'
      ? requestedTab
      : null;
  if (!hasSidParam) {
    const location = await refreshPublicShareEntryLocation(params.shareToken);
    if (location) {
      if (standaloneTab) {
        redirect(rewritePublicShareLocation(location, params.shareToken, standaloneTab, requestedSeriesId));
      }
      redirect(location);
    }
  }

  const shareResult = await fetchPublicShareFromSearchParams(searchParams);

  if (!shareResult.ok) {
    if (shouldAutoRefreshShareSignature(shareResult.status, shareResult.errorCode)) {
      const location = await refreshPublicShareEntryLocation(params.shareToken);
      if (location) {
        if (standaloneTab) {
          redirect(rewritePublicShareLocation(location, params.shareToken, standaloneTab, requestedSeriesId));
        }
        redirect(location);
      }
    }

    return (
      <PublicShareErrorPanel
        title="公开图鉴不可用"
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
          <h1>公开图鉴不可用</h1>
          <p className="notice notice-warning">该链接不是用户图鉴分享链接。</p>
        </section>
      </main>
    );
  }

  const legacyData = mapTenantFeedToLegacy(shareResult.data);
  const shareRouteQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query);
  if (requestedSeriesId) {
    shareRouteQuery.set('series', requestedSeriesId);
  }

  if (standaloneTab) {
    redirect(`/public/s/${params.shareToken}/${standaloneTab}?${shareRouteQuery.toString()}`);
  }

  const shareQuery = shareRouteQuery.toString();

  return (
    <PublicFeedPage
      demo={false}
      shareToken={params.shareToken}
      shareQuery={shareQuery}
      initialSeriesId={requestedSeriesId}
      series={legacyData.series}
      breeders={legacyData.breeders}
      presentation={shareResult.data.presentation}
      tenantSlug={shareResult.data.tenant.slug}
      tenantName={shareResult.data.tenant.name}
      stats={shareResult.data.stats ?? null}
    />
  );
}

function rewritePublicShareLocation(
  location: string,
  shareToken: string,
  tab: 'features' | 'me',
  seriesId?: string,
) {
  const resolved = new URL(location, 'http://public-share.local');
  resolved.pathname = `/public/s/${shareToken}/${tab}`;
  resolved.searchParams.delete('tab');
  if (seriesId) {
    resolved.searchParams.set('series', seriesId);
  }
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
