import { ReactNode } from 'react';

import { DashboardAccessGuard } from '../../components/dashboard/dashboard-access-guard';
import { DashboardShell } from '../../components/dashboard/dashboard-shell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardAccessGuard>
      <DashboardShell>{children}</DashboardShell>
    </DashboardAccessGuard>
  );
}
