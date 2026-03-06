'use client';

import { ReactNode, useState } from 'react';

import { DashboardBottomDock } from '@/components/dashboard/dashboard-bottom-dock';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';
import { DashboardTopTabs } from '@/components/dashboard/dashboard-top-tabs';
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar';

type DashboardShellProps = {
  children: ReactNode;
  currentUserEmail: string;
};

export function DashboardShell({ children, currentUserEmail }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  function handleToggleSidebar() {
    setCollapsed((value) => !value);
  }

  return (
    <div className={`dashboard-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <DashboardSidebar collapsed={collapsed} />
      <div className="dashboard-main">
        <DashboardTopbar collapsed={collapsed} currentUserEmail={currentUserEmail} onToggleSidebar={handleToggleSidebar} />
        <DashboardTopTabs />
        <main className="content">{children}</main>
      </div>
      <DashboardBottomDock />
    </div>
  );
}
