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
    description: 'Create and inspect tenant workspaces.'
  },
  {
    href: '/dashboard/memberships',
    label: 'Memberships',
    description: 'Grant tenant membership and roles.'
  },
  {
    href: '/dashboard/audit-logs',
    label: 'Audit Logs',
    description: 'Track super-admin operations.'
  }
];
