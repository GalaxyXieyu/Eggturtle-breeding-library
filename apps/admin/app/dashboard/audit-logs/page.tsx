import { redirect } from 'next/navigation';

export default function DashboardAuditLogsLegacyPage() {
  redirect('/dashboard/settings/audit-logs');
}
