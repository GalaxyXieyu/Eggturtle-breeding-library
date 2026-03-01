import { notFound } from 'next/navigation';

import PublicBreederDetailPage from '../../_public-breeder/public-breeder-detail-page';
import { getPublicBreederDetailData, getPublicFeedData } from '../../_public-breeder/data-source';

export default async function PublicBreederDetailRoute({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { demo?: string };
}) {
  const demo = searchParams?.demo === '1';

  if (!demo) {
    notFound();
  }

  const detailData = await getPublicBreederDetailData(params.id, true);
  const feedData = await getPublicFeedData({ demo: true });

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
      demo={true}
      shareToken="demo"
    />
  );
}
