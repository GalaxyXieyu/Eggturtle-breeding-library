import { redirect } from 'next/navigation';

import { mapTenantFeedToLegacy } from '@/app/public/_public-product/public-share-adapter';
import PublicShareErrorPanel from '@/app/public/_shared/public-share-error-panel';
import PublicShareSeriesPageRedesign from '@/app/public/s/[shareToken]/series/page-redesign';
import {
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
      redirect(rewritePublicShareLocation(location, params.shareToken));
    }
  }

  const shareResult = await fetchPublicShareFromSearchParams(searchParams);

  if (!shareResult.ok) {
    if (shouldAutoRefreshShareSignature(shareResult.status, shareResult.errorCode)) {
      const location = await refreshPublicShareEntryLocation(params.shareToken);
      if (location) {
        redirect(rewritePublicShareLocation(location, params.shareToken));
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
  const shareRouteQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query);
  const seriesId = firstSearchParamValue(searchParams.series)?.trim();
  if (seriesId) {
    shareRouteQuery.set('series', seriesId);
  }
  const shareQuery = shareRouteQuery.toString();

  return (
    <PublicShareSeriesPageRedesign
      shareToken={params.shareToken}
      shareQuery={shareQuery}
      presentation={shareResult.data.presentation}
      breeders={legacyData.breeders}
      series={legacyData.series}
      embedded={false}
    />
  );
}

function rewritePublicShareLocation(location: string, shareToken: string) {
  const resolved = new URL(location, 'http://public-share.local');
  resolved.pathname = `/public/s/${shareToken}/series`;
  resolved.searchParams.delete('tab');
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
