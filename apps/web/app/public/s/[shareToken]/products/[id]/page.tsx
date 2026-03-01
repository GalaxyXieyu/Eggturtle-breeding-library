import PublicBreederDetailPage from '../../../../_public-breeder/public-breeder-detail-page';
import { mapPublicProductToLegacyBreeder } from '../../../../_public-breeder/public-share-adapter';
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
  const shareResult = await fetchPublicShareFromSearchParams(searchParams);

  if (!shareResult.ok) {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>分享页不可用</h1>
          <p className="notice notice-error">{shareResult.message}</p>
        </section>
      </main>
    );
  }

  if (shareResult.data.resourceType !== 'product') {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>分享页不可用</h1>
          <p className="notice notice-warning">该链接不是产品分享链接。</p>
        </section>
      </main>
    );
  }

  const { tenant, product } = shareResult.data;
  if (product.id !== params.id) {
    return (
      <main className="share-shell">
        <section className="card panel stack">
          <h1>分享页不可用</h1>
          <p className="notice notice-warning">链接中的产品标识与分享内容不匹配。</p>
        </section>
      </main>
    );
  }

  const breeder = mapPublicProductToLegacyBreeder(product);
  const shareQuery = buildPublicShareRouteQuery(shareResult.shareId, shareResult.query).toString();
  const homeHref = `/public/s/${params.shareToken}/products/${params.id}?${shareQuery}`;
  const series = breeder.seriesId ? { id: breeder.seriesId, name: breeder.seriesId } : null;

  return (
    <PublicBreederDetailPage
      breeder={breeder}
      breederId={params.id}
      series={series}
      events={[]}
      familyTree={null}
      maleMateLoad={[]}
      fallbackBreeders={[]}
      demo={false}
      shareToken={params.shareToken}
      shareQuery={shareQuery}
      homeHref={homeHref}
    />
  );
}
