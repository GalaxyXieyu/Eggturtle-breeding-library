'use client';

import Link from 'next/link';
import { getAdminTenantResponseSchema } from '@eggturtle/shared';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { apiRequest } from '@/lib/api-client';
import { UiPreferenceControls, useUiPreferences, type UiLocale } from '@/components/ui-preferences';
import {
  DASHBOARD_SECTION_MESSAGES,
  DASHBOARD_SEGMENT_MESSAGES,
  DASHBOARD_TOPBAR_MESSAGES,
} from '@/lib/locales/shell';

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

export function DashboardTopbar({
  collapsed,
  currentUserEmail,
  onToggleSidebar
}: DashboardTopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useUiPreferences();
  const messages = DASHBOARD_TOPBAR_MESSAGES[locale];
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
    [...breadcrumbs].reverse().find((crumb) => crumb.isCurrent)?.label ?? messages.currentPageFallback;
  const sidebarToggleLabel = collapsed ? messages.expandSidebar : messages.collapseSidebar;

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
          <nav className="breadcrumbs" aria-label={messages.breadcrumbsLabel}>
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
          {messages.currentAccount} {currentUserEmail}
        </p>
        <button className="secondary" type="button" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? messages.signingOut : messages.signOut}
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
  const messages = DASHBOARD_TOPBAR_MESSAGES[locale];

  if (!pathname.startsWith('/dashboard')) {
    return [{ label: messages.baseLabel, isCurrent: true }] satisfies BreadcrumbItem[];
  }

  const segments = pathname.split('/').filter(Boolean).slice(1);
  const breadcrumbs: BreadcrumbItem[] = [{ label: messages.baseLabel, href: '/dashboard', isCurrent: false }];

  if (segments.length === 0) {
    breadcrumbs.push({ label: messages.overviewLabel, isCurrent: true });
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
  const messages = DASHBOARD_SECTION_MESSAGES[locale];

  if (firstSegment === 'analytics' || firstSegment === 'usage' || firstSegment === 'billing') {
    return messages.data;
  }

  if (firstSegment === 'tenant-management' || firstSegment === 'tenants' || firstSegment === 'memberships') {
    return messages.users;
  }

  if (firstSegment === 'settings' || firstSegment === 'audit-logs') {
    return messages.settings;
  }

  return null;
}

function resolveSegmentLabel(segment: string, locale: UiLocale) {
  const mapped = DASHBOARD_SEGMENT_MESSAGES[locale][segment];
  if (mapped) {
    return mapped;
  }

  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatTenantLabel(tenantId: string, tenantName: string | null, locale: UiLocale) {
  if (tenantName) {
    return tenantName;
  }

  return DASHBOARD_TOPBAR_MESSAGES[locale].tenantLabel(tenantId);
}

function extractTenantId(pathname: string) {
  const match = pathname.match(/^\/dashboard\/tenants\/([^/]+)/u);
  return match ? match[1] : null;
}
