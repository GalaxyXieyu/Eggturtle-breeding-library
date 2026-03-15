import { redirect } from 'next/navigation';

export default function SubscriptionPageRoute({
  params,
  searchParams,
}: {
  params: { tenantSlug: string };
  searchParams?: {
    focus?: string;
    purchase?: string;
    wechatAuth?: string;
  };
}) {
  const query = new URLSearchParams();
  query.set('tab', 'subscription');

  if (searchParams?.focus) {
    query.set('focus', searchParams.focus);
  }
  if (searchParams?.purchase) {
    query.set('purchase', searchParams.purchase);
  }
  if (searchParams?.wechatAuth) {
    query.set('wechatAuth', searchParams.wechatAuth);
  }

  redirect(`/app/${params.tenantSlug}/account?${query.toString()}`);
}
