import { type DashboardNavIcon } from '@/components/dashboard/nav-config'

type DashboardNavIconProps = {
  icon: DashboardNavIcon
}

export function DashboardNavIconGlyph({ icon }: DashboardNavIconProps) {
  if (icon === 'overview') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M2.5 8.5h4v5h-4zm7 0h4v5h-4zm-7-6h4v4h-4zm7 2h4v2h-4z" fill="currentColor" />
      </svg>
    )
  }

  if (icon === 'tenantManagement') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M3 3.5h10v9H3z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 6h6M5 8.5h6M5 11h4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    )
  }

  if (icon === 'records') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M4 2.8h6l2 2v8.4H4z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M10 2.8v2h2M5.3 7h5.4M5.3 9.4h5.4M5.3 11.8h3.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    )
  }

  return null
}
