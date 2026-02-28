export type DashboardNavItem = {
  href: string;
  label: string;
  description: string;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: '/dashboard',
    label: 'Overview',
    description: 'Cross-tenant snapshot and recent activity.'
  },
  {
    href: '/dashboard/tenants',
    label: 'Tenants',
    description: 'Browse tenant workspaces and inspect details.'
  },
  {
    href: '/dashboard/memberships',
    label: 'Memberships',
    description: 'View members and update tenant roles.'
  },
  {
    href: '/dashboard/audit-logs',
    label: 'Audit Logs',
    description: 'Track super-admin operations with filters.'
  }
];
