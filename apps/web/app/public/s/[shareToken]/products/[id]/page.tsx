import { redirect } from 'next/navigation';

import PublicProductDetailPage from '../../../../_public-product/public-product-detail-page';
import {
  mapPublicShareDetail,
  mapPublicProductToLegacyBreeder,
  mapTenantFeedToLegacy
} from '../../../../_public-product/public-share-adapter';
import PublicShareErrorPanel from '../../../../_shared/public-share-error-panel';
import {
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  refreshPublicShareEntryLocation,
  shouldAutoRefreshShareSignature,
  type PublicSearchParams
} from '../../../../_shared/public-share-api';

export default async function PublicShareProductDetailPage({
  params,
  searchParams
}: {
  params: { shareToken: string; id: string };
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

  const shareResult = await fetchPublicShareFromSearchParams(searchParams, {
    productId: params.id
  });

  if (!shareResult.ok) {
    if (shouldAutoRefreshShareSignature(shareResult.status, shareResult.errorCode)) {
      const location = await refreshPublicShareEntryLocation(params.shareToken);
      if (location) {
        redirect(location);
      }
    }

    return (
      <PublicShareErrorPanel
        title="公开详情不可用"
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
          <h1>公开详情不可用</h1>
          <p className="notice notice-warning">该链接不是租户图鉴分享链接。</p>
        </section>
      </main>
    );
  }

  const shareQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query).toString();
  const legacyFeedData = mapTenantFeedToLegacy(shareResult.data);
  const detailData = mapPublicShareDetail(shareResult.data);
  const detailBreeder = shareResult.data.product
    ? mapPublicProductToLegacyBreeder(shareResult.data.product)
    : null;

  const series = detailBreeder
    ? legacyFeedData.series.find((item) => item.id === detailBreeder.seriesId) || null
    : null;

  return (
    <PublicProductDetailPage
      breeder={detailBreeder}
      breederId={params.id}
      series={series}
      events={detailData.events}
      familyTree={detailData.familyTree}
      maleMateLoad={detailData.maleMateLoad}
      fallbackBreeders={legacyFeedData.breeders.slice(0, 4)}
      demo={false}
      shareToken={params.shareToken}
      shareQuery={shareQuery}
      homeHref={`/app/${shareResult.data.tenant.slug}`}
      presentation={shareResult.data.presentation}
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
