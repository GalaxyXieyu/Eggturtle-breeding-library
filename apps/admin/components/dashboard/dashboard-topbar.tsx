'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type DashboardTopbarProps = {
  collapsed: boolean;
  currentUserEmail: string;
  onToggleSidebar: () => void;
};

export function DashboardTopbar({
  collapsed,
  currentUserEmail,
  onToggleSidebar
}: DashboardTopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname]);
  const currentPageLabel = breadcrumbs[breadcrumbs.length - 1] ?? 'Overview';

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    try {
      await fetch('/api/auth/session', {
        method: 'DELETE',
        cache: 'no-store'
      });
    } finally {
      router.replace('/login');
      router.refresh();
      setSigningOut(false);
    }
  }

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

      <div className="topbar-actions">
        <p className="topbar-meta">Signed in as {currentUserEmail}</p>
        <button className="secondary" type="button" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
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
