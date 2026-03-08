export type DashboardLocaleText = {
  zh: string;
  en: string;
};

export type DashboardNavIcon =
  | 'overview'
  | 'activity'
  | 'usage'
  | 'revenue'
  | 'tenants'
  | 'memberships'
  | 'audit';

export type DashboardNavItem = {
  href: string;
  icon: DashboardNavIcon;
  label: DashboardLocaleText;
  description: DashboardLocaleText;
  matchStrategy?: 'exact' | 'prefix';
};

export type DashboardNavGroup = {
  id: string;
  title: DashboardLocaleText;
  items: DashboardNavItem[];
};

export const dashboardNavGroups: DashboardNavGroup[] = [
  {
    id: 'overview',
    title: { zh: '总览', en: 'Overview' },
    items: [
      {
        href: '/dashboard',
        icon: 'overview',
        label: { zh: '平台总览', en: 'Platform Overview' },
        description: {
          zh: '跨用户关键指标与最近操作。',
          en: 'Cross-tenant key metrics and recent activities.'
        },
        matchStrategy: 'exact'
      }
    ]
  },
  {
    id: 'data',
    title: { zh: '数据', en: 'Data' },
    items: [
      {
        href: '/dashboard/analytics',
        icon: 'activity',
        label: { zh: '活跃度', en: 'Activity' },
        description: {
          zh: '查看 DAU/WAU/MAU 与活跃用户趋势。',
          en: 'Track DAU/WAU/MAU and tenant activity trends.'
        }
      },
      {
        href: '/dashboard/usage',
        icon: 'usage',
        label: { zh: '用量', en: 'Usage' },
        description: {
          zh: '观测配额与调用消耗风险。',
          en: 'Observe quota and API consumption risks.'
        }
      },
      {
        href: '/dashboard/analytics/revenue',
        icon: 'revenue',
        label: { zh: '营收', en: 'Revenue' },
        description: {
          zh: '分析订阅结构与营收变化。',
          en: 'Analyze subscription mix and revenue changes.'
        }
      }
    ]
  },
  {
    id: 'governance',
    title: { zh: '用户治理', en: 'Tenant Governance' },
    items: [
      {
        href: '/dashboard/tenants',
        icon: 'tenants',
        label: { zh: '用户目录', en: 'Tenant Directory' },
        description: {
          zh: '浏览用户信息并进入详情治理。',
          en: 'Browse tenants and open governance details.'
        }
      },
      {
        href: '/dashboard/memberships',
        icon: 'memberships',
        label: { zh: '成员权限', en: 'Member Access' },
        description: {
          zh: '按用户管理成员角色与权限。',
          en: 'Manage tenant member roles and access.'
        }
      },
      {
        href: '/dashboard/audit-logs',
        icon: 'audit',
        label: { zh: '操作记录', en: 'Activity Logs' },
        description: {
          zh: '检索平台治理动作与审计证据。',
          en: 'Search governance actions and audit evidence.'
        }
      }
    ]
  }
];
