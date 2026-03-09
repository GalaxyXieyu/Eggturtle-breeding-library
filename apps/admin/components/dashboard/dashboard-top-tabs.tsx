'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useUiPreferences } from '@/components/ui-preferences'

const TAB_ITEMS = [
  { href: '/dashboard', match: 'exact', label: { zh: '数据', en: 'Data' } },
  { href: '/dashboard/tenant-management', match: 'prefix', label: { zh: '用户', en: 'Users' } },
  { href: '/dashboard/audit-logs', match: 'prefix', label: { zh: '记录', en: 'Records' } }
] as const

export function DashboardTopTabs() {
  const pathname = usePathname()
  const { locale } = useUiPreferences()

  return (
    <nav className="dashboard-top-tabs" aria-label={locale === 'zh' ? '主导航' : 'Primary navigation'}>
      <ul className="dashboard-top-tabs-list">
        {TAB_ITEMS.map((item) => {
          const active = item.match === 'exact'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <li key={item.href} className="dashboard-top-tabs-item">
              <Link
                href={item.href}
                className={`dashboard-top-tab-link${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label[locale]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
