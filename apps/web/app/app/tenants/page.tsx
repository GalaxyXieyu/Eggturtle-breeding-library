import { redirect } from 'next/navigation';

export default function LegacyTenantPage() {
  redirect('/tenant-select');
}
