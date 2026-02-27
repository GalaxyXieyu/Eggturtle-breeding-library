'use client';

import { ReactNode, useState } from 'react';

import { DashboardSidebar } from './dashboard-sidebar';
import { DashboardTopbar } from './dashboard-topbar';

type DashboardShellProps = {
  children: ReactNode;
  currentUserEmail: string;
};

export function DashboardShell({ children, currentUserEmail }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`dashboard-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <DashboardSidebar collapsed={collapsed} />
      <div className="dashboard-main">
        <DashboardTopbar
          collapsed={collapsed}
          currentUserEmail={currentUserEmail}
          onToggleSidebar={() => setCollapsed((value) => !value)}
        />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
