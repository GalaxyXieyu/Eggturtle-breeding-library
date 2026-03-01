import { notFound } from 'next/navigation';

import PublicFeedPage from './_public-product/public-feed-page';
import { getPublicFeedData } from './_public-product/data-source';

export default async function PublicPage({
  searchParams,
}: {
  searchParams?: { demo?: string };
}) {
  const demo = searchParams?.demo === '1';

  if (!demo) {
    notFound();
  }

  const data = await getPublicFeedData({ demo: true });

  return (
    <PublicFeedPage
      demo={true}
      shareToken="demo"
      series={data.series}
      breeders={data.breeders}
      presentation={data.presentation}
    />
  );
}
