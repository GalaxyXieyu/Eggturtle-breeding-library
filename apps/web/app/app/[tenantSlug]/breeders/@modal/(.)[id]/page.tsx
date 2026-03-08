import BreederDetailPage from '@/app/app/[tenantSlug]/breeders/[id]/page';
import BreederDetailRouteModal from '@/app/app/[tenantSlug]/breeders/@modal/_components/breeder-detail-route-modal';

export default function BreederDetailModalPage({
  params
}: {
  params: { tenantSlug: string; id: string };
}) {
  const fallbackPath = `/app/${encodeURIComponent(params.tenantSlug)}/breeders`;

  return (
    <BreederDetailRouteModal fallbackPath={fallbackPath}>
      <BreederDetailPage />
    </BreederDetailRouteModal>
  );
}
