import { redirect } from 'next/navigation';

import PublicShareErrorPanel from '@/app/public/_shared/public-share-error-panel';
import PublicShareMePage from '@/app/public/_shared/public-share-me-page';
import {
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  firstSearchParamValue,
  refreshPublicShareEntryLocation,
  shouldAutoRefreshShareSignature,
  type PublicSearchParams
} from '@/app/public/_shared/public-share-api';

export default async function PublicShareMeRoute({
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
        title="页面暂不可用"
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
          <h1>页面暂不可用</h1>
          <p className="notice notice-warning">该链接不是租户图鉴分享链接。</p>
        </section>
      </main>
    );
  }

  const shareRouteQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query);
  const seriesId = firstSearchParamValue(searchParams.series)?.trim();
  if (seriesId) {
    shareRouteQuery.set('series', seriesId);
  }

  return (
    <PublicShareMePage
      shareToken={params.shareToken}
      shareQuery={shareRouteQuery.toString()}
      presentation={shareResult.data.presentation}
    />
  );
}
