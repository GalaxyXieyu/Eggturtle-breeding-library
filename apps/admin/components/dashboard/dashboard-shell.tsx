'use client';

import { ReactNode, useState } from 'react';

import { DashboardBottomDock } from './dashboard-bottom-dock';
import { DashboardSidebar } from './dashboard-sidebar';
import { DashboardTopTabs } from './dashboard-top-tabs';
import { DashboardTopbar } from './dashboard-topbar';

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
