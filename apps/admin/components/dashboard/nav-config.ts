export type DashboardLocaleText = {
  zh: string;
  en: string;
};

export type DashboardNavItem = {
  href: string;
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
        label: { zh: '总览首页', en: 'Overview Home' },
        description: {
          zh: '跨租户关键指标与最近操作。',
          en: 'Cross-tenant key metrics and recent activities.'
        },
        matchStrategy: 'exact'
      }
    ]
  },
  {
    id: 'tenants',
    title: { zh: '租户', en: 'Tenants' },
    items: [
      {
        href: '/dashboard/tenants',
        label: { zh: '租户目录', en: 'Tenant Directory' },
        description: {
          zh: '浏览租户工作区并查看详情。',
          en: 'Browse tenant workspaces and inspect details.'
        }
      }
    ]
  },
  {
    id: 'memberships',
    title: { zh: '成员', en: 'Memberships' },
    items: [
      {
        href: '/dashboard/memberships',
        label: { zh: '成员关系', en: 'Membership Matrix' },
        description: {
          zh: '查看成员并调整租户角色。',
          en: 'Review members and adjust tenant roles.'
        }
      }
    ]
  },
  {
    id: 'audit',
    title: { zh: '审计', en: 'Audit' },
    items: [
      {
        href: '/dashboard/audit-logs',
        label: { zh: '操作日志', en: 'Audit Logs' },
        description: {
          zh: '按条件追踪平台级操作。',
          en: 'Trace platform operations with filters.'
        }
      }
    ]
  },
  {
    id: 'analytics',
    title: { zh: '分析', en: 'Analytics' },
    items: [
      {
        href: '/dashboard/analytics',
        label: { zh: '分析总览', en: 'Analytics Overview' },
        description: {
          zh: '平台分析能力入口。',
          en: 'Entry point for platform analytics views.'
        },
        matchStrategy: 'exact'
      },
      {
        href: '/dashboard/analytics/activity',
        label: { zh: '活跃度', en: 'Activity' },
        description: {
          zh: '查看活跃租户与成员趋势。',
          en: 'Inspect tenant and membership activity trends.'
        }
      },
      {
        href: '/dashboard/analytics/revenue',
        label: { zh: '营收', en: 'Revenue' },
        description: {
          zh: '分析订阅和营收结构。',
          en: 'Track subscription and revenue structure.'
        }
      }
    ]
  },
  {
    id: 'usage',
    title: { zh: '用量', en: 'Usage' },
    items: [
      {
        href: '/dashboard/usage',
        label: { zh: '用量总览', en: 'Usage Overview' },
        description: {
          zh: '观测配额与调用消耗。',
          en: 'Observe quota and API consumption.'
        }
      }
    ]
  },
  {
    id: 'billing',
    title: { zh: '计费', en: 'Billing' },
    items: [
      {
        href: '/dashboard/billing',
        label: { zh: '计费中心', en: 'Billing Center' },
        description: {
          zh: '管理账单、发票与支付状态。',
          en: 'Manage invoices, statements and payment status.'
        }
      }
    ]
  }
];
