'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useUiPreferences } from '@/components/ui-preferences';

const TAB_ITEMS = [
  {
    href: '/dashboard/settings/platform-branding',
    label: { zh: '平台品牌', en: 'Platform Branding' },
  },
  {
    href: '/dashboard/settings/tenant-branding',
    label: { zh: '租户品牌', en: 'Tenant Branding' },
  },
  {
    href: '/dashboard/settings/audit-logs',
    label: { zh: '审计记录', en: 'Audit Logs' },
  },
] as const;

export function DashboardSettingsTabs() {
  const pathname = usePathname();
  const { locale } = useUiPreferences();

  return (
    <nav className="dashboard-settings-tabs" aria-label={locale === 'zh' ? '设置二级导航' : 'Settings navigation'}>
      <div className="dashboard-settings-tabs-list" role="tablist">
        {TAB_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={active}
              className={`dashboard-settings-tab${active ? ' active' : ''}`}
            >
              {item.label[locale]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
