'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useUiPreferences } from '../ui-preferences';
import {
  dashboardNavGroups,
  type DashboardNavIcon,
  type DashboardNavItem
} from './nav-config';

const webSuperAdminEnabled = process.env.NEXT_PUBLIC_SUPER_ADMIN_ENABLED === 'true';

type DashboardSidebarProps = {
  collapsed: boolean;
  isMobile: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const SIDEBAR_COPY = {
  zh: {
    asideAriaLabel: '后台导航',
    navAriaLabel: '后台主导航',
    brandTitle: '蛋龟选育库 平台后台',
    brandSubtitle: '跨租户运维控制台',
    closeMobile: '关闭导航',
    hint: '后台权限由服务端会话 + 白名单双重校验。'
  },
  en: {
    asideAriaLabel: 'Admin navigation',
    navAriaLabel: 'Admin primary navigation',
    brandTitle: 'Eggturtle Admin Console',
    brandSubtitle: 'Cross-tenant operations control',
    closeMobile: 'Close navigation',
    hint: 'Access control is enforced by session validation and allowlist checks.'
  }
} as const;

export function DashboardSidebar({ collapsed, isMobile, mobileOpen, onCloseMobile }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { locale } = useUiPreferences();
  const copy = SIDEBAR_COPY[locale];

  return (
    <aside
      className={`dashboard-sidebar${mobileOpen ? ' is-open' : ''}`}
      aria-label={copy.asideAriaLabel}
      aria-hidden={isMobile && !mobileOpen}
    >
      <div className="sidebar-brand">
        <span className="sidebar-brand-logo">ET</span>
        <div className="sidebar-brand-copy">
          <strong>{copy.brandTitle}</strong>
          <span>{copy.brandSubtitle}</span>
        </div>
        <button
          type="button"
          className="sidebar-mobile-close"
          onClick={onCloseMobile}
          aria-label={copy.closeMobile}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <nav className="sidebar-nav" aria-label={copy.navAriaLabel}>
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
                    onClick={isMobile ? onCloseMobile : undefined}
                  >
                    <span className="sidebar-nav-icon" aria-hidden="true">
                      <SidebarNavIcon icon={item.icon} />
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
        <p className={`sidebar-hint${webSuperAdminEnabled ? ' enabled' : ''}`}>{copy.hint}</p>
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

function SidebarNavIcon({ icon }: { icon: DashboardNavIcon }) {
  if (icon === 'overview') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M2.5 8.5h4v5h-4zm7 0h4v5h-4zm-7-6h4v4h-4zm7 2h4v2h-4z" fill="currentColor" />
      </svg>
    );
  }

  if (icon === 'activity') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M2 11h2.4l1.6-4 2.1 6L10.5 6l1.2 5H14" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }

  if (icon === 'usage') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M3 3h10v10H3z" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }

  if (icon === 'revenue') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M3 11.5 6.8 8l2.2 2 3.1-4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M11.2 5.8h2v2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }

  if (icon === 'tenants') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M2.8 6.4h4v6.8h-4zm6.4-3.2h4v10h-4z" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }

  if (icon === 'memberships') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <circle cx="5.5" cy="5.2" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="10.8" cy="6.2" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2.5 12c0-1.8 1.5-3.2 3.3-3.2h.4c1.8 0 3.3 1.4 3.3 3.2M8.8 12c.1-1.4 1.3-2.5 2.8-2.5h.2c1 0 1.8.3 2.2.9" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <path d="M8 2.3 13 4v4.9c0 2.3-1.9 4.2-5 4.8-3.1-.6-5-2.5-5-4.8V4z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.1 8.1 7.4 9.4 10.3 6.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
