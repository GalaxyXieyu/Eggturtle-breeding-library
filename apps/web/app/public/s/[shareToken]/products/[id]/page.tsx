import PublicProductDetailPage from '../../../../_public-product/public-product-detail-page';
import {
  mapPublicShareDetail,
  mapPublicProductToLegacyBreeder,
  mapTenantFeedToLegacy
} from '../../../../_public-product/public-share-adapter';
import {
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  type PublicSearchParams
} from '../../../../_shared/public-share-api';

export default async function PublicShareProductDetailPage({
  params,
  searchParams
}: {
  params: { shareToken: string; id: string };
  searchParams: PublicSearchParams;
}) {
  const shareResult = await fetchPublicShareFromSearchParams(searchParams, {
    productId: params.id
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
      presentation={shareResult.data.presentation}
    />
  );
}
