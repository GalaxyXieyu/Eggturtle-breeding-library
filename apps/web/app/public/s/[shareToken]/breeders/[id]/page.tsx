import PublicBreederDetailPage from '../../../../_legacy/public-breeder-detail-page';
import { getPublicBreederDetailData, getPublicFeedData } from '../../../../_legacy/data-source';

export default async function PublicShareBreederDetailPage({
  params,
  searchParams,
}: {
  params: { shareToken: string; id: string };
  searchParams?: { demo?: string };
}) {
  const demo = searchParams?.demo === '1';
  const detailData = await getPublicBreederDetailData(params.id, demo);
  const feedData = await getPublicFeedData({ demo });

  const series = detailData.breeder
    ? feedData.series.find((item) => item.id === detailData.breeder?.seriesId) || null
    : null;

  return (
    <PublicBreederDetailPage
      breeder={detailData.breeder}
      breederId={params.id}
      series={series}
      events={detailData.events}
      familyTree={detailData.familyTree}
      maleMateLoad={detailData.maleMateLoad}
      fallbackBreeders={detailData.fallbackBreeders}
      demo={demo}
      shareToken={params.shareToken}
    />
  );
}
