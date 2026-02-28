export type DashboardNavItem = {
  href: string;
  label: string;
  description: string;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: '/dashboard',
    label: '总览',
    description: '跨租户关键指标与最近操作。'
  },
  {
    href: '/dashboard/tenants',
    label: '租户',
    description: '浏览租户工作区并查看详情。'
  },
  {
    href: '/dashboard/memberships',
    label: '成员',
    description: '查看成员并调整租户角色。'
  },
  {
    href: '/dashboard/audit-logs',
    label: '审计日志',
    description: '按条件追踪平台级操作。'
  }
];
