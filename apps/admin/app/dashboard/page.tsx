'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listAdminTenantsResponseSchema,
  listSuperAdminAuditLogsResponseSchema,
  type AdminActivityOverviewResponse,
  type AdminRevenueOverviewResponse,
  type AdminTenant,
  type AdminUsageOverviewResponse,
  type SuperAdminAuditLog
} from '@eggturtle/shared';

import {
  AdminActionLink,
  AdminBadge,
  AdminMetricCard,
  AdminPanel,
  AdminTableFrame
} from '@/components/dashboard/polish-primitives';
import { useUiPreferences } from '@/components/ui-preferences';
import {
  apiRequest,
  getAdminActivityOverview,
  getAdminRevenueOverview,
  getAdminUsageOverview
} from '@/lib/api-client';
import { formatAuditActionLabel, formatPlanLabel } from '@/lib/admin-labels';
import { formatDateTime, formatUnknownError } from '@/lib/formatters';
import { DASHBOARD_OVERVIEW_MESSAGES } from '@/lib/locales/dashboard-pages';

type OverviewState = {
  loading: boolean;
  error: string | null;
  tenants: AdminTenant[];
  logs: SuperAdminAuditLog[];
  activityOverview: AdminActivityOverviewResponse | null;
  revenueOverview: AdminRevenueOverviewResponse | null;
  usageOverview: AdminUsageOverviewResponse | null;
};

type MobileOverviewSection = 'trend' | 'revenue' | 'usage' | 'records';

export default function DashboardOverviewPage() {
  const { locale } = useUiPreferences();
  const messages = DASHBOARD_OVERVIEW_MESSAGES[locale];
  const [state, setState] = useState<OverviewState>({
    loading: true,
    error: null,
    tenants: [],
    logs: [],
    activityOverview: null,
    revenueOverview: null,
    usageOverview: null
  });
  const [activeMobileSection, setActiveMobileSection] = useState<MobileOverviewSection>('trend');
  const detailSectionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((previous) => ({
        ...previous,
        loading: true,
        error: null
      }));

      try {
        const [tenantResponse, logResponse, activityOverview, revenueOverview, usageOverview] = await Promise.all([
          apiRequest('/admin/tenants', {
            responseSchema: listAdminTenantsResponseSchema
          }),
          apiRequest('/admin/audit-logs?page=1&pageSize=5', {
            responseSchema: listSuperAdminAuditLogsResponseSchema
          }),
          getAdminActivityOverview({ window: '30d' }),
          getAdminRevenueOverview({ window: '30d' }),
          getAdminUsageOverview({ topN: 5 })
        ]);

        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: null,
          tenants: tenantResponse.tenants,
          logs: logResponse.logs,
          activityOverview,
          revenueOverview,
          usageOverview
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState((previous) => ({
          ...previous,
          loading: false,
          error: formatUnknownError(error, { fallback: messages.unknownError, locale })
        }));
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [locale, messages.unknownError]);

  const expiringSoonTenants = useMemo(
    () =>
      state.tenants
        .filter((tenant) => tenant.autoTags.some((tag) => tag.key === 'expiring_soon'))
        .slice(0, 10),
    [state.tenants]
  );

  const noOwnerCount = useMemo(
    () => state.tenants.filter((tenant) => tenant.autoTags.some((tag) => tag.key === 'no_owner')).length,
    [state.tenants]
  );

  const activityTrendMax = useMemo(() => {
    const values = (state.activityOverview?.trend ?? []).flatMap((item) => [item.dau, item.activeTenants]);
    return Math.max(...values, 1);
  }, [state.activityOverview]);

  const mobileSectionTabs = useMemo(
    () => [
      { key: 'trend' as const, label: messages.trendTitle },
      { key: 'revenue' as const, label: messages.revenueTitle },
      { key: 'usage' as const, label: messages.usageTitle },
      { key: 'records' as const, label: messages.recordsTitle }
    ],
    [messages.recordsTitle, messages.revenueTitle, messages.trendTitle, messages.usageTitle]
  );

  function handleMobileSectionChange(nextSection: MobileOverviewSection) {
    setActiveMobileSection(nextSection);
    requestAnimationFrame(() => {
      detailSectionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <section className="page admin-page">
      <h2 className="visually-hidden">{messages.title}</h2>

      <nav
        className="data-overview-section-nav"
        aria-label={locale === 'zh' ? '数据二级导航' : 'Data secondary navigation'}
      >
        <div className="data-overview-section-nav-list" role="tablist">
          {mobileSectionTabs.map((section) => (
            <button
              key={section.key}
              type="button"
              role="tab"
              className={`data-overview-section-tab${activeMobileSection === section.key ? ' active' : ''}`}
              aria-selected={activeMobileSection === section.key}
              onClick={() => handleMobileSectionChange(section.key)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="admin-metrics-grid">
        <AdminMetricCard
          label={messages.tenantTotal}
          value={state.tenants.length}
          meta={<AdminActionLink href="/dashboard/tenant-management">{messages.viewUsers}</AdminActionLink>}
        />
        <AdminMetricCard
          label={messages.activeTenants}
          value={state.activityOverview?.kpis.activeTenants7d ?? '-'}
          meta={<span>{messages.retention7d}: {formatPercent(state.activityOverview?.kpis.tenantRetention7d ?? null)}</span>}
        />
        <AdminMetricCard
          label={messages.monthlyActiveUsers}
          value={state.activityOverview?.kpis.mau ?? '-'}
          meta={<span>{messages.wau}: {state.activityOverview?.kpis.wau ?? '-'} · {messages.dau}: {state.activityOverview?.kpis.dau ?? '-'}</span>}
        />
        <AdminMetricCard
          label={messages.monthlyRevenue}
          value={formatCurrency(state.revenueOverview?.kpis.mrrCents ?? null, locale)}
          meta={<span>{messages.payingTenants}: {state.revenueOverview?.kpis.payingTenantCount ?? '-'}</span>}
        />
        <AdminMetricCard
          label={messages.totalStorage}
          value={formatBytes(state.usageOverview?.summary.totalStorageBytes ?? null)}
          meta={<span>{messages.nearLimit}: {state.usageOverview?.summary.nearLimitTenantCount ?? '-'} · {messages.exceeded}: {state.usageOverview?.summary.exceededTenantCount ?? '-'}</span>}
        />
        <AdminMetricCard label={messages.expiringSoon} value={expiringSoonTenants.length} />
        <AdminMetricCard label={messages.noOwner} value={noOwnerCount} />
        <AdminMetricCard
          label={messages.recentOps}
          value={state.logs.length}
          meta={<AdminActionLink href="/dashboard/settings/audit-logs">{messages.viewRecords}</AdminActionLink>}
        />
      </div>

      <div ref={detailSectionsRef} className="data-overview-grid">
        <AdminPanel className={`stack data-overview-panel${activeMobileSection === 'trend' ? ' is-active' : ''}`}>
          <div className="admin-section-head">
            <h3>{messages.trendTitle}</h3>
            <p>{messages.trendDesc}</p>
          </div>

          <div className="data-overview-micro-grid">
            <div className="data-overview-micro-card">
              <span>{messages.dau}</span>
              <strong>{state.activityOverview?.kpis.dau ?? '-'}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{messages.wau}</span>
              <strong>{state.activityOverview?.kpis.wau ?? '-'}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{messages.mau}</span>
              <strong>{state.activityOverview?.kpis.mau ?? '-'}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{messages.retention7d}</span>
              <strong>{formatPercent(state.activityOverview?.kpis.tenantRetention7d ?? null)}</strong>
            </div>
          </div>

          <div className="data-trend-list">
            {(state.activityOverview?.trend ?? []).slice(-7).map((item) => (
              <div key={item.date} className="data-trend-row">
                <span className="mono">{item.date.slice(5)}</span>
                <div className="admin-trend-bar data-trend-bar">
                  <span style={{ width: `${Math.max((Math.max(item.dau, item.activeTenants) / activityTrendMax) * 100, 4)}%` }} />
                </div>
                <span>{messages.dau}: {item.dau}</span>
                <span>{messages.activeUsers7d}: {item.activeTenants}</span>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel className={`stack data-overview-panel${activeMobileSection === 'revenue' ? ' is-active' : ''}`}>
          <div className="admin-section-head">
            <h3>{messages.revenueTitle}</h3>
            <p>{messages.revenueDesc}</p>
          </div>

          <div className="data-overview-list">
            {(state.revenueOverview?.planBreakdown ?? []).map((plan) => (
              <div key={plan.plan} className="data-overview-row">
                <div className="stack row-tight">
                  <strong>{formatPlanLabel(plan.plan, locale)}</strong>
                  <span className="muted">{messages.payingTenants}: {plan.payingTenantCount}</span>
                </div>
                <AdminBadge tone={plan.plan === 'PRO' ? 'accent' : plan.plan === 'BASIC' ? 'info' : 'neutral'}>
                  {formatCurrency(plan.mrrCents, locale)}
                </AdminBadge>
              </div>
            ))}
          </div>

          <div className="stack row-tight">
            <strong>{messages.upcomingRenewals}</strong>
            {expiringSoonTenants.length === 0 ? <p className="muted">{messages.noneUpcoming}</p> : null}
            <div className="data-overview-list">
              {expiringSoonTenants.map((tenant) => (
                <div key={tenant.id} className="data-overview-row">
                  <div className="stack row-tight">
                    <strong>{tenant.name}</strong>
                    <span className="mono">{tenant.slug}</span>
                  </div>
                  <AdminActionLink href={`/dashboard/tenants/${tenant.id}`}>{messages.viewTenant}</AdminActionLink>
                </div>
              ))}
            </div>
          </div>
        </AdminPanel>

        <AdminPanel className={`stack data-overview-panel${activeMobileSection === 'usage' ? ' is-active' : ''}`}>
          <div className="admin-section-head">
            <h3>{messages.usageTitle}</h3>
            <p>{messages.usageDesc}</p>
          </div>

          <div className="data-overview-micro-grid">
            <div className="data-overview-micro-card">
              <span>{messages.totalStorage}</span>
              <strong>{formatBytes(state.usageOverview?.summary.totalStorageBytes ?? null)}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{messages.nearLimit}</span>
              <strong>{state.usageOverview?.summary.nearLimitTenantCount ?? '-'}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{messages.exceeded}</span>
              <strong>{state.usageOverview?.summary.exceededTenantCount ?? '-'}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{messages.payingTenants}</span>
              <strong>{state.revenueOverview?.kpis.payingTenantCount ?? '-'}</strong>
            </div>
          </div>

          <div className="stack row-tight">
            <strong>{messages.topStorage}</strong>
            {(state.usageOverview?.topTenants.length ?? 0) === 0 ? <p className="muted">{messages.noneTopStorage}</p> : null}
            <div className="data-overview-list">
              {(state.usageOverview?.topTenants ?? []).map((tenant) => (
                <div key={tenant.tenantId} className="data-overview-row">
                  <div className="stack row-tight">
                    <strong>{tenant.tenantName}</strong>
                    <span className="mono">{tenant.tenantSlug}</span>
                  </div>
                  <div className="stack row-tight data-overview-end">
                    <span>{formatBytes(tenant.usage.storageBytes.usedBytes)}</span>
                    <span className="muted">{formatUtilizationPercent(tenant.usage.storageBytes.utilization)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AdminPanel>

        <AdminPanel className={`stack data-overview-panel data-overview-span-full${activeMobileSection === 'records' ? ' is-active' : ''}`}>
          <div className="admin-section-head">
            <h3>{messages.recordsTitle}</h3>
            <p>{messages.recordsDesc}</p>
          </div>

          {state.logs.length === 0 ? <p className="muted">{messages.noAudit}</p> : null}
          {state.logs.length > 0 ? (
            <>
              <div className="data-record-list">
                {state.logs.map((log) => (
                  <article key={`mobile-${log.id}`} className="data-record-item">
                    <div className="data-record-head">
                      <strong>{formatAuditActionLabel(log.action, locale)}</strong>
                      <span className="data-record-time">{formatDateTime(log.createdAt)}</span>
                    </div>
                    <div className="data-record-grid">
                      <div className="stack row-tight">
                        <span className="data-record-label">{messages.actor}</span>
                        <span>{log.actorUserEmail ?? '-'}</span>
                        <span className="mono">{log.actorUserId}</span>
                      </div>
                      <div className="stack row-tight">
                        <span className="data-record-label">{messages.tenant}</span>
                        <span>{log.targetTenantSlug ?? '-'}</span>
                        <span className="mono">{log.targetTenantId ?? '-'}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="data-record-desktop-table">
                <AdminTableFrame>
                  <thead>
                    <tr>
                      <th>{messages.action}</th>
                      <th>{messages.actor}</th>
                      <th>{messages.tenant}</th>
                      <th>{messages.time}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.logs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatAuditActionLabel(log.action, locale)}</td>
                        <td>
                          <div className="stack row-tight">
                            <span>{log.actorUserEmail ?? '-'}</span>
                            <span className="mono">{log.actorUserId}</span>
                          </div>
                        </td>
                        <td>
                          <div className="stack row-tight">
                            <span>{log.targetTenantSlug ?? '-'}</span>
                            <span className="mono">{log.targetTenantId ?? '-'}</span>
                          </div>
                        </td>
                        <td>{formatDateTime(log.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTableFrame>
              </div>
            </>
          ) : null}
        </AdminPanel>
      </div>

      {state.loading ? <p className="muted">{messages.loading}</p> : null}
      {state.error ? <p className="error">{state.error}</p> : null}
    </section>
  );
}

function formatCurrency(cents: number | null, locale: 'zh' | 'en') {
  if (cents === null) {
    return '-';
  }

  const currency = locale === 'zh' ? 'CNY' : 'USD';

  try {
    return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(cents / 100);
  } catch {
    return String(cents);
  }
}

function formatPercent(value: number | null) {
  if (value === null) {
    return '-';
  }

  return `${Math.round(value * 100)}%`;
}

function formatUtilizationPercent(value: number | null) {
  if (value === null) {
    return '-';
  }

  const percent = Math.round(value * 100);
  if (percent > 9999) {
    return '9999%+';
  }

  return `${percent}%`;
}

function formatBytes(bytes: string | null) {
  if (!bytes) {
    return '-';
  }

  const value = Number(bytes);
  if (!Number.isFinite(value)) {
    return bytes;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let current = value;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  const formatted = current >= 10 ? current.toFixed(0) : current.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}
