import { redirect } from 'next/navigation';

export default function PublicBreederDetailCompatRoute({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { demo?: string };
}) {
  const query = new URLSearchParams();

  if (searchParams?.demo) {
    query.set('demo', searchParams.demo);
  }

  const suffix = query.toString();
  redirect(`/public/products/${params.id}${suffix ? `?${suffix}` : ''}`);
}
