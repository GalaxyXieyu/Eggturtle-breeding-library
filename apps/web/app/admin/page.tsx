import { DeprecatedAdminEntry } from '@/app/admin/_shared/deprecated-admin-entry';

export const dynamic = 'force-dynamic';

export default function DeprecatedWebAdminEntry() {
  return <DeprecatedAdminEntry targetPath="/dashboard" />;
}
