'use client';

import Link from 'next/link';
import { getAdminTenantResponseSchema } from '@eggturtle/shared';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { apiRequest } from '@/lib/api-client';
import { UiPreferenceControls, useUiPreferences, type UiLocale } from '@/components/ui-preferences';

type DashboardTopbarProps = {
  collapsed: boolean;
  currentUserEmail: string;
  onToggleSidebar: () => void;
};

type BreadcrumbItem = {
  label: string;
  href?: string;
  isCurrent: boolean;
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
  const [tenantName, setTenantName] = useState<string | null>(null);

  const tenantId = useMemo(() => extractTenantId(pathname), [pathname]);

  useEffect(() => {
    if (!tenantId) {
      setTenantName(null);
      return;
    }

    let cancelled = false;
    setTenantName(null);

    async function loadTenantName() {
      try {
        const response = await apiRequest(`/admin/tenants/${tenantId}`, {
          responseSchema: getAdminTenantResponseSchema
        });
        if (!cancelled) {
          setTenantName(response.tenant.name);
        }
      } catch {
        if (!cancelled) {
          setTenantName(null);
        }
      }
    }

    void loadTenantName();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(pathname, locale, tenantId, tenantName),
    [pathname, locale, tenantId, tenantName]
  );
  const currentPageLabel =
    [...breadcrumbs].reverse().find((crumb) => crumb.isCurrent)?.label ??
    (locale === 'zh' ? '平台总览' : 'Overview');
  const sidebarToggleLabel = collapsed ? copy.expandSidebar : copy.collapseSidebar;

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    try {
      await fetch('/api/auth/session', {
        method: 'DELETE',
        headers: {
          'x-eggturtle-auth-surface': 'admin'
        },
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
          className="icon-button sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label={sidebarToggleLabel}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <div>
          <nav className="breadcrumbs" aria-label={copy.breadcrumbsLabel}>
            {breadcrumbs.map((crumb, index) => (
              <span
                key={`${crumb.label}-${index}`}
                className={`breadcrumb-item${crumb.isCurrent ? ' is-current' : ''}`}
              >
                {crumb.href && !crumb.isCurrent ? (
                  <Link href={crumb.href} className="breadcrumb-link">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={crumb.isCurrent ? 'page' : undefined}>{crumb.label}</span>
                )}
              </span>
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

function buildBreadcrumbs(
  pathname: string,
  locale: UiLocale,
  tenantId: string | null,
  tenantName: string | null
) {
  const baseLabel = locale === 'zh' ? '平台后台' : 'Admin Console';
  const overviewLabel = locale === 'zh' ? '数据' : 'Data';

  if (!pathname.startsWith('/dashboard')) {
    return [{ label: baseLabel, isCurrent: true }] satisfies BreadcrumbItem[];
  }

  const segments = pathname.split('/').filter(Boolean).slice(1);
  const breadcrumbs: BreadcrumbItem[] = [{ label: baseLabel, href: '/dashboard', isCurrent: false }];

  if (segments.length === 0) {
    breadcrumbs.push({ label: overviewLabel, isCurrent: true });
    return breadcrumbs;
  }

  const section = resolveSectionLabel(segments[0], locale);
  const firstSegmentLabel = resolveSegmentLabel(segments[0], locale);

  if (section) {
    const shouldCollapseFirstSegment = segments.length === 1 && firstSegmentLabel === section;
    breadcrumbs.push({
      label: section,
      href: shouldCollapseFirstSegment ? undefined : '/dashboard',
      isCurrent: shouldCollapseFirstSegment
    });
  }

  segments.forEach((segment, index) => {
    const isCurrent = index === segments.length - 1;
    const href = isCurrent ? undefined : `/dashboard/${segments.slice(0, index + 1).join('/')}`;
    const previousSegment = segments[index - 1];
    const label =
      previousSegment === 'tenants' && tenantId === segment
        ? formatTenantLabel(segment, tenantName, locale)
        : resolveSegmentLabel(segment, locale);

    if (index === 0 && section && label === section) {
      return;
    }

    breadcrumbs.push({
      label,
      href,
      isCurrent
    });
  });

  return breadcrumbs;
}

function resolveSectionLabel(firstSegment: string, locale: UiLocale) {
  if (firstSegment === 'analytics' || firstSegment === 'usage' || firstSegment === 'billing') {
    return locale === 'zh' ? '数据' : 'Data';
  }

  if (firstSegment === 'tenant-management' || firstSegment === 'tenants' || firstSegment === 'memberships') {
    return locale === 'zh' ? '用户' : 'Users';
  }

  if (firstSegment === 'settings' || firstSegment === 'audit-logs') {
    return locale === 'zh' ? '设置' : 'Settings';
  }

  return null;
}

function resolveSegmentLabel(segment: string, locale: UiLocale) {
  const labelMap: Record<string, { zh: string; en: string }> = {
    'tenant-management': { zh: '用户', en: 'Users' },
    tenants: { zh: '用户详情', en: 'Tenant Detail' },
    memberships: { zh: '成员权限', en: 'Member Access' },
    settings: { zh: '设置', en: 'Settings' },
    'platform-branding': { zh: '平台品牌', en: 'Platform Branding' },
    'tenant-branding': { zh: '租户品牌', en: 'Tenant Branding' },
    'audit-logs': { zh: '审计记录', en: 'Audit Logs' },
    analytics: { zh: '活跃度', en: 'Activity' },
    usage: { zh: '用量', en: 'Usage' },
    billing: { zh: '营收', en: 'Revenue' },
    activity: { zh: '活跃度视图', en: 'Activity View' },
    revenue: { zh: '营收视图', en: 'Revenue View' }
  };

  const mapped = labelMap[segment];
  if (mapped) {
    return mapped[locale];
  }

  const words = segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return locale === 'zh' ? words : words;
}

function formatTenantLabel(tenantId: string, tenantName: string | null, locale: UiLocale) {
  if (tenantName) {
    return tenantName;
  }

  const shortTenantId = tenantId.length > 8 ? tenantId.slice(0, 8) : tenantId;
  return locale === 'zh' ? `用户 ${shortTenantId}` : `Tenant ${shortTenantId}`;
}

function extractTenantId(pathname: string) {
  const match = pathname.match(/^\/dashboard\/tenants\/([^/]+)/u);
  return match ? match[1] : null;
}
