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

type BilingualCopy = {
  zh: string;
  en: string;
};

type AdminPlaceholderRouteProps = {
  title: BilingualCopy;
  description: BilingualCopy;
  panelTitle?: BilingualCopy;
  panelDescription?: BilingualCopy;
  emptyState: BilingualCopy;
  milestone?: string;
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

export function AdminPlaceholderRoute({
  title,
  description,
  panelTitle,
  panelDescription,
  emptyState,
  milestone = 'T6x'
}: AdminPlaceholderRouteProps) {
  const defaultPanelTitle: BilingualCopy = { zh: '功能占位', en: 'Feature Placeholder' };
  const defaultPanelDescription: BilingualCopy = {
    zh: '该治理域页面正在建设中，将在后续迭代补齐。',
    en: 'This governance-domain page is under construction and will be completed in a follow-up iteration.'
  };

  return (
    <section className="page admin-page">
      <AdminPageHeader
        eyebrow="EggTurtle Admin / 治理域占位"
        title={formatBilingualCopy(title)}
        description={formatBilingualCopy(description)}
      />

      <AdminPanel className="stack">
        <div className="admin-section-head">
          <h3>{formatBilingualCopy(panelTitle ?? defaultPanelTitle)}</h3>
          <p>{formatBilingualCopy(panelDescription ?? defaultPanelDescription)}</p>
        </div>
        <p className="muted">{formatBilingualCopy(emptyState)}</p>
        <p className="muted">
          {`尚未实现，后续在 ${milestone} 补齐。 / Not implemented yet, planned for completion in ${milestone}.`}
        </p>
      </AdminPanel>
    </section>
  );
}

function formatBilingualCopy(copy: BilingualCopy) {
  return `${copy.zh} / ${copy.en}`;
}
