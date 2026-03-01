import PublicFeedPage from '../../_public-breeder/public-feed-page';
import { mapTenantFeedToLegacy } from '../../_public-breeder/public-share-adapter';
import {
  buildPublicShareRouteQuery,
  fetchPublicShareFromSearchParams,
  type PublicSearchParams
} from '../../_shared/public-share-api';

export default async function PublicShareFeedPage({
  params,
  searchParams,
}: {
  params: { shareToken: string };
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

  const legacyData = mapTenantFeedToLegacy(shareResult.data);
  const shareQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query).toString();

  return (
    <PublicFeedPage
      demo={false}
      shareToken={params.shareToken}
      shareQuery={shareQuery}
      series={legacyData.series}
      breeders={legacyData.breeders}
    />
  );
}
