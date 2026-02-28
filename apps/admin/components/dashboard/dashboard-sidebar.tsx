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
    <aside className="dashboard-sidebar" aria-label="Dashboard sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-logo">ET</span>
        <div className="sidebar-brand-copy">
          <strong>Eggturtle Admin</strong>
          <span>Backoffice shell</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Dashboard navigation">
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
          Super-admin access is enforced by server session + allowlist.
        </p>
      </div>
    </aside>
  );
}
