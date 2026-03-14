import { redirect } from 'next/navigation';

import PublicShareFeaturesScreen from '@/app/public/_shared/public-share-features-screen';
import PublicShareErrorPanel from '@/app/public/_shared/public-share-error-panel';
import {
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  firstSearchParamValue,
  refreshPublicShareEntryLocation,
  shouldAutoRefreshShareSignature,
  type PublicSearchParams,
} from '@/app/public/_shared/public-share-api';

export default async function PublicShareFeaturesRoute({
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

  const shareRouteQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query);
  const seriesId = firstSearchParamValue(searchParams.series)?.trim();
  if (seriesId) {
    shareRouteQuery.set('series', seriesId);
  }
  const shareQuery = shareRouteQuery.toString();

  return (
    <PublicShareFeaturesScreen
      shareToken={params.shareToken}
      shareQuery={shareQuery}
      presentation={shareResult.data.presentation}
      embedded={false}
    />
  );
}

function rewritePublicShareLocation(location: string, shareToken: string) {
  const resolved = new URL(location, 'http://public-share.local');
  resolved.pathname = `/public/s/${shareToken}/features`;
  resolved.searchParams.delete('tab');
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
