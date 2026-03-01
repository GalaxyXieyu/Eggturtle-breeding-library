export type DashboardNavItem = {
  href: string;
  label: {
    zh: string;
    en: string;
  };
  description: {
    zh: string;
    en: string;
  };
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: '/dashboard',
    label: { zh: '总览', en: 'Overview' },
    description: { zh: '跨租户关键指标与最近操作。', en: 'Cross-tenant key metrics and recent activities.' }
  },
  {
    href: '/dashboard/tenants',
    label: { zh: '租户', en: 'Tenants' },
    description: { zh: '浏览租户工作区并查看详情。', en: 'Browse tenant workspaces and inspect details.' }
  },
  {
    href: '/dashboard/memberships',
    label: { zh: '成员', en: 'Memberships' },
    description: { zh: '查看成员并调整租户角色。', en: 'Review members and adjust tenant roles.' }
  },
  {
    href: '/dashboard/audit-logs',
    label: { zh: '审计日志', en: 'Audit Logs' },
    description: { zh: '按条件追踪平台级操作。', en: 'Trace platform operations with filters.' }
  }
];
