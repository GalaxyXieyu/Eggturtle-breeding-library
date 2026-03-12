'use client';

import { usePathname, useRouter } from 'next/navigation';

import { DashboardNavIconGlyph } from '@/components/dashboard/dashboard-nav-icon';
import { dashboardNavGroups, type DashboardNavIcon, type DashboardNavItem } from '@/components/dashboard/nav-config';
import { useUiPreferences } from '@/components/ui-preferences';
import { DASHBOARD_BOTTOM_DOCK_MESSAGES } from '@/lib/locales/shell';

const dataItems = dashboardNavGroups.find((group) => group.id === 'data')?.items ?? [];
const managementItems = dashboardNavGroups.find((group) => group.id === 'users')?.items ?? [];
const settingsItems = dashboardNavGroups.find((group) => group.id === 'settings')?.items ?? [];

const tabs: Array<{
  href: string;
  icon: DashboardNavIcon;
  labelKey: 'dataLabel' | 'managementLabel' | 'settingsLabel';
  matchItems: DashboardNavItem[];
}> = [
  {
    href: '/dashboard',
    icon: 'overview',
    labelKey: 'dataLabel',
    matchItems: dataItems
  },
  {
    href: '/dashboard/tenant-management',
    icon: 'tenantManagement',
    labelKey: 'managementLabel',
    matchItems: managementItems
  },
  {
    href: '/dashboard/settings/platform-branding',
    icon: 'settings',
    labelKey: 'settingsLabel',
    matchItems: settingsItems
  }
];

export function DashboardBottomDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useUiPreferences();
  const messages = DASHBOARD_BOTTOM_DOCK_MESSAGES[locale];

  function handleTabSwitch(href: string, active: boolean) {
    if (active) {
      return;
    }

    router.replace(href, { scroll: false });
  }

  return (
    <nav className="tenant-mobile-nav" aria-label={messages.navAriaLabel}>
      <div className="tenant-mobile-nav-shell" aria-hidden="true" />
      <ul className="tenant-mobile-nav-list">
        {tabs.map((tab) => {
          const active = tab.matchItems.some((item) => isNavItemActive(pathname, item));
          const label = messages[tab.labelKey];

          return (
            <li key={tab.href} className="tenant-mobile-nav-item">
              <button
                type="button"
                data-ui="button"
                aria-label={label}
                className={`tenant-mobile-nav-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                aria-pressed={active}
                onClick={() => handleTabSwitch(tab.href, active)}
              >
                <span className="tenant-mobile-nav-stack">
                  <span className="tenant-mobile-nav-icon" aria-hidden="true">
                    <DashboardNavIconGlyph icon={tab.icon} />
                  </span>
                  <span className="tenant-mobile-nav-label">{label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function isNavItemActive(pathname: string, item: DashboardNavItem) {
  if (item.matchStrategy === 'exact') {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
