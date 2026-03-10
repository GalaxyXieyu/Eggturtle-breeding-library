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

  if (icon === 'settings') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path
          d="M8 3.2a.9.9 0 0 1 .9-.9h.5a.9.9 0 0 1 .9.9v.6c.4.1.8.3 1.1.6l.5-.3a.9.9 0 0 1 1.2.3l.2.4a.9.9 0 0 1-.3 1.2l-.5.3c.1.4.1.8 0 1.2l.5.3a.9.9 0 0 1 .3 1.2l-.2.4a.9.9 0 0 1-1.2.3l-.5-.3c-.3.3-.7.5-1.1.6v.6a.9.9 0 0 1-.9.9h-.5a.9.9 0 0 1-.9-.9v-.6a3.6 3.6 0 0 1-1.1-.6l-.5.3a.9.9 0 0 1-1.2-.3l-.2-.4a.9.9 0 0 1 .3-1.2l.5-.3a3.6 3.6 0 0 1 0-1.2l-.5-.3a.9.9 0 0 1-.3-1.2l.2-.4a.9.9 0 0 1 1.2-.3l.5.3c.3-.3.7-.5 1.1-.6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
        />
        <circle cx="8" cy="8" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    )
  }

  return null
}
