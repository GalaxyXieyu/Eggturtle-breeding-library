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
  const currentPageLabel = breadcrumbs[breadcrumbs.length - 1] ?? '总览';

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
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <div>
          <nav className="breadcrumbs" aria-label="面包屑">
            {breadcrumbs.map((crumb) => (
              <span key={crumb}>{crumb}</span>
            ))}
          </nav>
          <h1>{currentPageLabel}</h1>
        </div>
      </div>

      <div className="topbar-actions">
        <p className="topbar-meta">当前账号：{currentUserEmail}</p>
        <button className="secondary" type="button" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? '退出中...' : '退出登录'}
        </button>
      </div>
    </header>
  );
}

function buildBreadcrumbs(pathname: string) {
  if (!pathname.startsWith('/dashboard')) {
    return ['平台后台'];
  }

  const segments = pathname
    .split('/')
    .filter(Boolean)
    .slice(1)
    .map((segment) => toTitleCase(segment));

  return ['平台后台', ...(segments.length > 0 ? segments : ['总览'])];
}

function toTitleCase(segment: string) {
  const zhMap: Record<string, string> = {
    tenants: '租户',
    memberships: '成员',
    audit: '审计',
    logs: '日志'
  };

  return segment
    .split('-')
    .map((word) => zhMap[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
