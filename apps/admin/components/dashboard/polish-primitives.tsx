import Link from 'next/link';
import type { ReactNode } from 'react';

type ClassNameProps = {
  className?: string;
};

type AdminPageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
};

type AdminPanelProps = ClassNameProps & {
  children: ReactNode;
};

type AdminMetricCardProps = {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
};

type AdminBadgeProps = ClassNameProps & {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
};

type AdminActionLinkProps = {
  href: string;
  children: ReactNode;
};

function cx(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

export function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow = 'EggTurtle Admin'
}: AdminPageHeaderProps) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-header-copy">
        <p className="admin-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="admin-page-description">{description}</p>
      </div>
      {actions ? <div className="admin-page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function AdminPanel({ className, children }: AdminPanelProps) {
  return <article className={cx('admin-panel', className)}>{children}</article>;
}

export function AdminMetricCard({ label, value, meta }: AdminMetricCardProps) {
  return (
    <AdminPanel className="admin-metric-card">
      <p className="admin-metric-label">{label}</p>
      <p className="admin-metric-value">{value}</p>
      {meta ? <p className="admin-metric-meta">{meta}</p> : null}
    </AdminPanel>
  );
}

export function AdminBadge({ children, tone = 'neutral', className }: AdminBadgeProps) {
  return <span className={cx('admin-badge', `tone-${tone}`, className)}>{children}</span>;
}

export function AdminActionLink({ href, children }: AdminActionLinkProps) {
  return (
    <Link className="admin-action-link" href={href}>
      {children}
    </Link>
  );
}

export function AdminTableFrame({ children, className }: AdminPanelProps) {
  return (
    <div className={cx('admin-table-frame', className)}>
      <table className="data-table">{children}</table>
    </div>
  );
}
