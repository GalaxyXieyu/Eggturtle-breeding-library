import PublicProductDetailPage from '@/app/public/_public-product/public-product-detail-page';
import PublicShareErrorPanel from '@/app/public/_shared/public-share-error-panel';
import type { PublicSearchParams } from '@/app/public/_shared/public-share-api';
import PublicShareDetailModal from '@/app/public/s/[shareToken]/@modal/_components/public-share-detail-modal';
import { loadPublicShareProductDetail } from '@/app/public/s/[shareToken]/products/[id]/public-share-product-detail-loader';

export default async function PublicShareProductDetailModalPage({
  params,
  searchParams
}: {
  params: { shareToken: string; id: string };
  searchParams: PublicSearchParams;
}) {
  const resolved = await loadPublicShareProductDetail(params, searchParams);
  const fallbackPath = `/public/s/${encodeURIComponent(params.shareToken)}`;

  return (
    <PublicShareDetailModal fallbackPath={fallbackPath}>
      {resolved.ok ? (
        <PublicProductDetailPage {...resolved.data} />
      ) : (
        <PublicShareErrorPanel
          title={resolved.title}
          message={resolved.message}
          shareToken={params.shareToken}
          canAutoRefresh={false}
        />
      )}
    </PublicShareDetailModal>
  );
}
