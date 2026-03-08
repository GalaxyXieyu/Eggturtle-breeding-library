import PublicProductDetailPage from '@/app/public/_public-product/public-product-detail-page';
import PublicShareErrorPanel from '@/app/public/_shared/public-share-error-panel';
import type { PublicSearchParams } from '@/app/public/_shared/public-share-api';

import { loadPublicShareProductDetail } from './public-share-product-detail-loader';

export default async function PublicShareProductDetailPage({
  params,
  searchParams
}: {
  params: { shareToken: string; id: string };
  searchParams: PublicSearchParams;
}) {
  const resolved = await loadPublicShareProductDetail(params, searchParams);

  if (!resolved.ok) {
    return (
      <PublicShareErrorPanel
        title={resolved.title}
        message={resolved.message}
        shareToken={params.shareToken}
        canAutoRefresh={false}
      />
    );
  }

  return <PublicProductDetailPage {...resolved.data} />;
}
