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
  | 'audit'
  | 'tenantManagement';

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
        href: '/dashboard/tenant-management',
        icon: 'tenantManagement',
        label: { zh: '用户管理', en: 'Tenant Management' },
        description: {
          zh: '统一管理用户目录与成员权限。',
          en: 'Manage tenant directory and memberships in one place.'
        }
      },
      {
        href: '/dashboard/tenants',
        icon: 'tenants',
        label: { zh: '用户目录（旧）', en: 'Tenant Directory (legacy)' },
        description: {
          zh: '旧入口，后续会逐步合并到「用户管理」。',
          en: 'Legacy entry, to be consolidated into Tenant Management.'
        }
      },
      {
        href: '/dashboard/memberships',
        icon: 'memberships',
        label: { zh: '成员权限（旧）', en: 'Member Access (legacy)' },
        description: {
          zh: '旧入口，后续会逐步合并到「用户管理」。',
          en: 'Legacy entry, to be consolidated into Tenant Management.'
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
