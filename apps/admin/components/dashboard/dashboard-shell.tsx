'use client';

import { ReactNode, useState } from 'react';

import { DashboardSidebar } from './dashboard-sidebar';
import { DashboardTopbar } from './dashboard-topbar';

export function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`dashboard-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <DashboardSidebar collapsed={collapsed} />
      <div className="dashboard-main">
        <DashboardTopbar collapsed={collapsed} onToggleSidebar={() => setCollapsed((value) => !value)} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
