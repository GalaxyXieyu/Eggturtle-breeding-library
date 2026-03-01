import PublicFeedPage from '../../_legacy/public-feed-page';
import { getPublicFeedData } from '../../_legacy/data-source';

export default async function PublicShareFeedPage({
  params,
  searchParams,
}: {
  params: { shareToken: string };
  searchParams?: { demo?: string };
}) {
  const demo = searchParams?.demo === '1';
  const data = await getPublicFeedData({ demo });

  return (
    <PublicFeedPage
      demo={demo}
      shareToken={params.shareToken}
      series={data.series}
      breeders={data.breeders}
    />
  );
}
