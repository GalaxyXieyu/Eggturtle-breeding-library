'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useUiPreferences } from '@/components/ui-preferences';
import { DashboardNavIconGlyph } from '@/components/dashboard/dashboard-nav-icon';
import {
  dashboardNavGroups,
  type DashboardNavItem
} from '@/components/dashboard/nav-config';
import { usePlatformBranding } from '@/lib/branding-client';
import { DASHBOARD_SIDEBAR_MESSAGES } from '@/lib/locales/shell';

type DashboardSidebarProps = {
  collapsed: boolean;
};

export function DashboardSidebar({ collapsed }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { locale } = useUiPreferences();
  const branding = usePlatformBranding();
  const brandMark =
    branding.appName.en
      .split(/\s+/)
      .map((word) => word[0] ?? '')
      .join('')
      .slice(0, 3)
      .toUpperCase() || 'BTR';
  const messages = {
    ...DASHBOARD_SIDEBAR_MESSAGES[locale],
    brandTitle: branding.adminTitle[locale],
    brandSubtitle: branding.adminSubtitle[locale],
  };

  return (
    <aside className="dashboard-sidebar" aria-label={messages.asideAriaLabel}>
      <div className="sidebar-brand">
        <span className="sidebar-brand-logo">{brandMark}</span>
        <div className="sidebar-brand-copy">
          <strong>{messages.brandTitle}</strong>
          <span>{messages.brandSubtitle}</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label={messages.navAriaLabel}>
        {dashboardNavGroups.map((group) => (
          <section key={group.id} className="sidebar-nav-group" aria-label={group.title[locale]}>
            <p className="sidebar-nav-group-title">{group.title[locale]}</p>
            <div className="sidebar-nav-group-items">
              {group.items.map((item) => {
                const isActive = isNavItemActive(pathname, item);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-nav-link${isActive ? ' active' : ''}`}
                    title={collapsed ? item.label[locale] : item.description[locale]}
                  >
                    <span className="sidebar-nav-icon" aria-hidden="true">
                      <DashboardNavIconGlyph icon={item.icon} />
                    </span>
                    <span className="sidebar-nav-label">{item.label[locale]}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p className="sidebar-hint enabled">{messages.hint}</p>
      </div>
    </aside>
  );
}

function isNavItemActive(pathname: string, item: DashboardNavItem) {
  if (item.matchStrategy === 'exact') {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
