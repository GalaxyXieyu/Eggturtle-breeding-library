'use client';

import { ReactNode, useEffect, useState } from 'react';

import { DashboardSidebar } from './dashboard-sidebar';
import { DashboardTopbar } from './dashboard-topbar';

type DashboardShellProps = {
  children: ReactNode;
  currentUserEmail: string;
};

export function DashboardShell({ children, currentUserEmail }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1024px)');

    const syncViewport = () => {
      setIsMobileViewport(media.matches);
      if (!media.matches) {
        setMobileSidebarOpen(false);
      }
    };

    syncViewport();
    media.addEventListener('change', syncViewport);

    return () => {
      media.removeEventListener('change', syncViewport);
    };
  }, []);

  function handleToggleSidebar() {
    if (isMobileViewport) {
      setMobileSidebarOpen((value) => !value);
      return;
    }

    setCollapsed((value) => !value);
  }

  function handleCloseMobileSidebar() {
    setMobileSidebarOpen(false);
  }

  return (
    <div
      className={`dashboard-shell${!isMobileViewport && collapsed ? ' sidebar-collapsed' : ''}${mobileSidebarOpen ? ' mobile-sidebar-open' : ''}`}
    >
      <DashboardSidebar
        collapsed={!isMobileViewport && collapsed}
        isMobile={isMobileViewport}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={handleCloseMobileSidebar}
      />
      <button
        type="button"
        className="sidebar-mobile-overlay"
        aria-hidden={!mobileSidebarOpen}
        tabIndex={mobileSidebarOpen ? 0 : -1}
        onClick={handleCloseMobileSidebar}
      />
      <div className="dashboard-main">
        <DashboardTopbar
          collapsed={!isMobileViewport && collapsed}
          currentUserEmail={currentUserEmail}
          isMobile={isMobileViewport}
          sidebarOpen={isMobileViewport ? mobileSidebarOpen : !collapsed}
          onToggleSidebar={handleToggleSidebar}
        />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
