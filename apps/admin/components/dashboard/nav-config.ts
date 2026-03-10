export type DashboardLocaleText = {
  zh: string
  en: string
}

export type DashboardNavIcon = 'overview' | 'tenantManagement' | 'settings'

export type DashboardNavItem = {
  href: string
  icon: DashboardNavIcon
  label: DashboardLocaleText
  description: DashboardLocaleText
  matchStrategy?: 'exact' | 'prefix'
}

export type DashboardNavGroup = {
  id: string
  title: DashboardLocaleText
  items: DashboardNavItem[]
}

export const dashboardNavGroups: DashboardNavGroup[] = [
  {
    id: 'data',
    title: { zh: '数据', en: 'Data' },
    items: [
      {
        href: '/dashboard',
        icon: 'overview',
        label: { zh: '数据', en: 'Data' },
        description: {
          zh: '平台总览与关键业务指标。',
          en: 'Platform overview and core business metrics.'
        },
        matchStrategy: 'exact'
      }
    ]
  },
  {
    id: 'users',
    title: { zh: '用户', en: 'Users' },
    items: [
      {
        href: '/dashboard/tenant-management',
        icon: 'tenantManagement',
        label: { zh: '用户', en: 'Users' },
        description: {
          zh: '用户治理工作台与详情驾驶舱。',
          en: 'Governance workspace and tenant cockpit.'
        },
        matchStrategy: 'prefix'
      }
    ]
  },
  {
    id: 'settings',
    title: { zh: '设置', en: 'Settings' },
    items: [
      {
        href: '/dashboard/audit-logs',
        icon: 'settings',
        label: { zh: '设置', en: 'Settings' },
        description: {
          zh: '平台设置与治理日志入口。',
          en: 'Platform settings and audit-log entry.'
        },
        matchStrategy: 'prefix'
      }
    ]
  }
]
