'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { UiPreferenceControls, useUiPreferences, type UiLocale } from '../ui-preferences';

type DashboardTopbarProps = {
  collapsed: boolean;
  currentUserEmail: string;
  onToggleSidebar: () => void;
};

const TOPBAR_COPY = {
  zh: {
    collapseSidebar: '收起侧边栏',
    expandSidebar: '展开侧边栏',
    breadcrumbsLabel: '面包屑',
    currentAccount: '当前账号：',
    signingOut: '退出中...',
    signOut: '退出登录'
  },
  en: {
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    breadcrumbsLabel: 'Breadcrumbs',
    currentAccount: 'Current account:',
    signingOut: 'Signing out...',
    signOut: 'Sign out'
  }
} as const;

export function DashboardTopbar({
  collapsed,
  currentUserEmail,
  onToggleSidebar
}: DashboardTopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useUiPreferences();
  const copy = TOPBAR_COPY[locale];
  const [signingOut, setSigningOut] = useState(false);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname, locale), [pathname, locale]);
  const currentPageLabel = breadcrumbs[breadcrumbs.length - 1] ?? (locale === 'zh' ? '总览' : 'Overview');

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
          aria-label={collapsed ? copy.expandSidebar : copy.collapseSidebar}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <div>
          <nav className="breadcrumbs" aria-label={copy.breadcrumbsLabel}>
            {breadcrumbs.map((crumb) => (
              <span key={crumb}>{crumb}</span>
            ))}
          </nav>
          <h1>{currentPageLabel}</h1>
        </div>
      </div>

      <div className="topbar-actions">
        <UiPreferenceControls />
        <p className="topbar-meta">
          {copy.currentAccount} {currentUserEmail}
        </p>
        <button className="secondary" type="button" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? copy.signingOut : copy.signOut}
        </button>
      </div>
    </header>
  );
}

function buildBreadcrumbs(pathname: string, locale: UiLocale) {
  const baseLabel = locale === 'zh' ? '平台后台' : 'Admin Console';
  const defaultLabel = locale === 'zh' ? '总览' : 'Overview';

  if (!pathname.startsWith('/dashboard')) {
    return [baseLabel];
  }

  const segments = pathname
    .split('/')
    .filter(Boolean)
    .slice(1)
    .map((segment) => toTitleCase(segment, locale));

  return [baseLabel, ...(segments.length > 0 ? segments : [defaultLabel])];
}

function toTitleCase(segment: string, locale: UiLocale) {
  const labelMap: Record<string, { zh: string; en: string }> = {
    tenants: { zh: '租户', en: 'Tenants' },
    memberships: { zh: '成员', en: 'Memberships' },
    audit: { zh: '审计', en: 'Audit' },
    logs: { zh: '日志', en: 'Logs' }
  };

  return segment
    .split('-')
    .map((word) => labelMap[word]?.[locale] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
