'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useUiPreferences } from '@/components/ui-preferences';
import { DashboardNavIconGlyph } from '@/components/dashboard/dashboard-nav-icon';
import {
  dashboardNavGroups,
  type DashboardNavItem
} from '@/components/dashboard/nav-config';

const webSuperAdminEnabled = process.env.NEXT_PUBLIC_SUPER_ADMIN_ENABLED === 'true';

type DashboardSidebarProps = {
  collapsed: boolean;
};

const SIDEBAR_COPY = {
  zh: {
    asideAriaLabel: '后台导航',
    navAriaLabel: '后台主导航',
    brandTitle: '选育溯源档案 平台后台',
    brandSubtitle: '跨用户运维控制台',
    hint: '后台权限由服务端会话 + 白名单双重校验。'
  },
  en: {
    asideAriaLabel: 'Admin navigation',
    navAriaLabel: 'Admin primary navigation',
    brandTitle: 'Eggturtle Admin Console',
    brandSubtitle: 'Cross-tenant operations control',
    hint: 'Access control is enforced by session validation and allowlist checks.'
  }
} as const;

export function DashboardSidebar({ collapsed }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { locale } = useUiPreferences();
  const copy = SIDEBAR_COPY[locale];

  return (
    <aside className="dashboard-sidebar" aria-label={copy.asideAriaLabel}>
      <div className="sidebar-brand">
        <span className="sidebar-brand-logo">ET</span>
        <div className="sidebar-brand-copy">
          <strong>{copy.brandTitle}</strong>
          <span>{copy.brandSubtitle}</span>
        </div>
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
