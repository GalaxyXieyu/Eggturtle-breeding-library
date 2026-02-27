'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

type DashboardTopbarProps = {
  collapsed: boolean;
  onToggleSidebar: () => void;
};

export function DashboardTopbar({ collapsed, onToggleSidebar }: DashboardTopbarProps) {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname]);
  const currentPageLabel = breadcrumbs[breadcrumbs.length - 1] ?? 'Overview';

  return (
    <header className="dashboard-topbar">
      <div className="topbar-main">
        <button
          type="button"
          className="icon-button"
          onClick={onToggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <div>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb) => (
              <span key={crumb}>{crumb}</span>
            ))}
          </nav>
          <h1>{currentPageLabel}</h1>
        </div>
      </div>

      <p className="topbar-meta">Session check placeholder (T29)</p>
    </header>
  );
}

function buildBreadcrumbs(pathname: string) {
  if (!pathname.startsWith('/dashboard')) {
    return ['Dashboard'];
  }

  const segments = pathname
    .split('/')
    .filter(Boolean)
    .slice(1)
    .map((segment) => toTitleCase(segment));

  return ['Dashboard', ...(segments.length > 0 ? segments : ['Overview'])];
}

function toTitleCase(segment: string) {
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
