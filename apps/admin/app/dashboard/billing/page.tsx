import { redirect } from 'next/navigation';

export default function DashboardBillingRedirectPage() {
  redirect('/dashboard/analytics/revenue');
}
