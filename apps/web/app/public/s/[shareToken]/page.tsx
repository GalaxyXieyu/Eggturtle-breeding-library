import { redirect } from 'next/navigation';

import PublicFeedPage from '../../_public-product/public-feed-page';
import { mapTenantFeedToLegacy } from '../../_public-product/public-share-adapter';
import PublicShareErrorPanel from '../../_shared/public-share-error-panel';
import {
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  refreshPublicShareEntryLocation,
  shouldAutoRefreshShareSignature,
  type PublicSearchParams
} from '../../_shared/public-share-api';

export default async function PublicShareFeedPage({
  params,
  searchParams,
}: {
  params: { shareToken: string };
  searchParams: PublicSearchParams;
}) {
  const sidValue = firstValue(searchParams.sid);
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
          <p className="notice notice-warning">该链接不是租户图鉴分享链接。</p>
        </section>
      </main>
    );
  }

  const legacyData = mapTenantFeedToLegacy(shareResult.data);
  const shareQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query).toString();

  return (
    <PublicFeedPage
      demo={false}
      shareToken={params.shareToken}
      shareQuery={shareQuery}
      series={legacyData.series}
      breeders={legacyData.breeders}
      presentation={shareResult.data.presentation}
      tenantSlug={shareResult.data.tenant.slug}
    />
  );
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
