import { type DashboardNavIcon } from '@/components/dashboard/nav-config';

type DashboardNavIconProps = {
  icon: DashboardNavIcon;
};

export function DashboardNavIconGlyph({ icon }: DashboardNavIconProps) {
  if (icon === 'overview') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M2.5 8.5h4v5h-4zm7 0h4v5h-4zm-7-6h4v4h-4zm7 2h4v2h-4z" fill="currentColor" />
      </svg>
    );
  }

  if (icon === 'activity') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path
          d="M2 11h2.4l1.6-4 2.1 6L10.5 6l1.2 5H14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    );
  }

  if (icon === 'usage') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M3 3h10v10H3z" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }

  if (icon === 'revenue') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M3 11.5 6.8 8l2.2 2 3.1-4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M11.2 5.8h2v2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }

  if (icon === 'tenants') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <path d="M2.8 6.4h4v6.8h-4zm6.4-3.2h4v10h-4z" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }

  if (icon === 'memberships') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14">
        <circle cx="5.5" cy="5.2" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="10.8" cy="6.2" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M2.5 12c0-1.8 1.5-3.2 3.3-3.2h.4c1.8 0 3.3 1.4 3.3 3.2M8.8 12c.1-1.4 1.3-2.5 2.8-2.5h.2c1 0 1.8.3 2.2.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <path
        d="M8 2.3 13 4v4.9c0 2.3-1.9 4.2-5 4.8-3.1-.6-5-2.5-5-4.8V4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M6.1 8.1 7.4 9.4 10.3 6.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
