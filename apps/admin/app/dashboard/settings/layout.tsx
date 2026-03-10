import type { ReactNode } from 'react';

import { DashboardSettingsTabs } from '@/components/dashboard/dashboard-settings-tabs';

export default function DashboardSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="settings-layout-stack">
      <DashboardSettingsTabs />
      {children}
    </div>
  );
}
