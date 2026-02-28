'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { dashboardNavItems } from './nav-config';

const webSuperAdminEnabled = process.env.NEXT_PUBLIC_SUPER_ADMIN_ENABLED === 'true';

type DashboardSidebarProps = {
  collapsed: boolean;
};

export function DashboardSidebar({ collapsed }: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="dashboard-sidebar" aria-label="后台导航">
      <div className="sidebar-brand">
        <span className="sidebar-brand-logo">ET</span>
        <div className="sidebar-brand-copy">
          <strong>Eggturtle 平台后台</strong>
          <span>跨租户运维控制台</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="后台主导航">
        {dashboardNavItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-link${isActive ? ' active' : ''}`}
              title={collapsed ? item.label : item.description}
            >
              <span className="sidebar-nav-marker" aria-hidden="true" />
              <span className="sidebar-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <p className={`sidebar-hint${webSuperAdminEnabled ? ' enabled' : ''}`}>
          后台权限由服务端会话 + 白名单双重校验。
        </p>
      </div>
    </aside>
  );
}
