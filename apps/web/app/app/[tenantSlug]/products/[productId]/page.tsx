import { redirect } from 'next/navigation';

type ProductLegacyManagePageProps = {
  params: {
    tenantSlug: string;
    productId: string;
  };
  searchParams?: {
    demo?: string;
  };
};

export default function ProductLegacyManagePage({
  params,
  searchParams,
}: ProductLegacyManagePageProps) {
  const query = new URLSearchParams();

  if (searchParams?.demo === '1') {
    query.set('demo', '1');
  }

  const queryString = query.toString();
  redirect(
    queryString
      ? `/app/${params.tenantSlug}/products?${queryString}`
      : `/app/${params.tenantSlug}/products`,
  );
}
