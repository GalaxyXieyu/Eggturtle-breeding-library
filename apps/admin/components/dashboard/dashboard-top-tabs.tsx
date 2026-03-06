'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useUiPreferences } from '@/components/ui-preferences';

type TopTabItem = {
  href: string;
  match: 'exact' | 'prefix';
  label: {
    zh: string;
    en: string;
  };
};

type TopTabGroup = {
  id: 'data' | 'management';
  items: TopTabItem[];
};

const TOP_TAB_COPY = {
  zh: {
    data: '数据导航',
    management: '管理导航'
  },
  en: {
    data: 'Data tabs',
    management: 'Management tabs'
  }
} as const;

const DATA_TAB_ITEMS: TopTabItem[] = [
  {
    href: '/dashboard',
    match: 'exact',
    label: { zh: '平台总览', en: 'Overview' }
  },
  {
    href: '/dashboard/analytics',
    match: 'prefix',
    label: { zh: '活跃度', en: 'Activity' }
  },
  {
    href: '/dashboard/usage',
    match: 'prefix',
    label: { zh: '用量', en: 'Usage' }
  },
  {
    href: '/dashboard/billing',
    match: 'prefix',
    label: { zh: '营收', en: 'Revenue' }
  }
];

const MANAGEMENT_TAB_ITEMS: TopTabItem[] = [
  {
    href: '/dashboard/memberships',
    match: 'prefix',
    label: { zh: '成员权限', en: 'Member Access' }
  },
  {
    href: '/dashboard/tenants',
    match: 'prefix',
    label: { zh: '租户目录', en: 'Tenant Directory' }
  },
  {
    href: '/dashboard/audit-logs',
    match: 'prefix',
    label: { zh: '操作记录', en: 'Activity Logs' }
  }
];

export function DashboardTopTabs() {
  const pathname = usePathname();
  const { locale } = useUiPreferences();
  const group = resolveActiveGroup(pathname);

  if (!group) {
    return null;
  }

  const navLabel = TOP_TAB_COPY[locale][group.id];

  return (
    <nav className="dashboard-top-tabs" aria-label={navLabel}>
      <ul className="dashboard-top-tabs-list">
        {group.items.map((item) => {
          const active = isTabItemActive(pathname, item);

          return (
            <li key={item.href} className="dashboard-top-tabs-item">
              <Link
                href={item.href}
                className={`dashboard-top-tab-link${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label[locale]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function resolveActiveGroup(pathname: string): TopTabGroup | null {
  if (DATA_TAB_ITEMS.some((item) => isTabItemActive(pathname, item))) {
    return {
      id: 'data',
      items: DATA_TAB_ITEMS
    };
  }

  if (MANAGEMENT_TAB_ITEMS.some((item) => isTabItemActive(pathname, item))) {
    return {
      id: 'management',
      items: MANAGEMENT_TAB_ITEMS
    };
  }

  return null;
}

function isTabItemActive(pathname: string, item: TopTabItem) {
  if (item.match === 'exact') {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
