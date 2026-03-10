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

const COPY = {
  zh: {
    eyebrow: '平台数据',
    title: '数据',
    description: '把平台关键指标、到期风险、存储风险和最新治理记录收在同一个总览里。',
    tenantTotal: '用户总数',
    activeTenants: '7天活跃用户',
    monthlyActiveUsers: '30天活跃用户',
    monthlyRevenue: 'MRR',
    totalStorage: '总存储',
    expiringSoon: '即将到期',
    noOwner: '无 Owner',
    recentOps: '最新治理记录',
    trendTitle: '活跃趋势',
    trendDesc: '用最近 30 天的日活与活跃用户数判断平台热度变化。',
    revenueTitle: '套餐与营收',
    revenueDesc: '把付费结构、即将到期名单和 MRR 放在一起看。',
    usageTitle: '存储与风险',
    usageDesc: '优先发现接近上限、高利用率和高占用用户。',
    recordsTitle: '最新平台记录',
    recordsDesc: '这里保留后台治理日志，便于追溯最近的治理动作。',
    activeUsers7d: '活跃用户(7d)',
    retention7d: '7日留存',
    dau: 'DAU',
    wau: 'WAU',
    mau: 'MAU',
    arr: 'ARR',
    payingTenants: '付费用户',
    nearLimit: '接近上限',
    exceeded: '已超限',
    topStorage: '存储 Top 5',
    upcomingRenewals: '即将到期提醒',
    noneUpcoming: '未来 7 天暂无到期用户。',
    noneTopStorage: '暂无存储风险用户。',
    noAudit: '当前暂无治理记录。',
    viewUsers: '进入用户工作台',
    viewRecords: '查看全部记录',
    viewTenant: '查看用户',
    action: '动作',
    actor: '操作者',
    tenant: '用户',
    time: '时间',
    loading: '加载数据中...',
    unknownError: '加载数据失败。'
  },
  en: {
    eyebrow: 'Platform Data',
    title: 'Data',
    description: 'Keep core metrics, renewal risk, storage risk, and latest governance records in one overview.',
    tenantTotal: 'Tenants',
    activeTenants: 'Active Tenants (7d)',
    monthlyActiveUsers: 'Monthly Active Users',
    monthlyRevenue: 'MRR',
    totalStorage: 'Total Storage',
    expiringSoon: 'Expiring Soon',
    noOwner: 'No Owner',
    recentOps: 'Recent Records',
    trendTitle: 'Activity Trend',
    trendDesc: 'Track the last 30 days of DAU and active-tenant movement.',
    revenueTitle: 'Plans & Revenue',
    revenueDesc: 'See paid mix, upcoming renewals, and MRR in one place.',
    usageTitle: 'Storage & Risk',
    usageDesc: 'Spot near-limit, exceeded, and heavy-usage tenants quickly.',
    recordsTitle: 'Latest Governance Records',
    recordsDesc: 'Keep recent back-office governance actions visible for traceability.',
    activeUsers7d: 'Active Tenants (7d)',
    retention7d: '7d Retention',
    dau: 'DAU',
    wau: 'WAU',
    mau: 'MAU',
    arr: 'ARR',
    payingTenants: 'Paying Tenants',
    nearLimit: 'Near Limit',
    exceeded: 'Exceeded',
    topStorage: 'Top 5 Storage',
    upcomingRenewals: 'Upcoming Renewals',
    noneUpcoming: 'No tenants expire in the next 7 days.',
    noneTopStorage: 'No storage-risk tenants yet.',
    noAudit: 'No governance records yet.',
    viewUsers: 'Open user workspace',
    viewRecords: 'View all records',
    viewTenant: 'Open tenant',
    action: 'Action',
    actor: 'Actor',
    tenant: 'Tenant',
    time: 'Time',
    loading: 'Loading data overview...',
    unknownError: 'Failed to load data overview.'
  }
} as const;

export default function DashboardOverviewPage() {
  const { locale } = useUiPreferences();
  const copy = COPY[locale];
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
          error: formatUnknownError(error, { fallback: copy.unknownError })
        }));
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [copy.unknownError]);

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
      { key: 'trend' as const, label: copy.trendTitle },
      { key: 'revenue' as const, label: copy.revenueTitle },
      { key: 'usage' as const, label: copy.usageTitle },
      { key: 'records' as const, label: copy.recordsTitle }
    ],
    [copy]
  );

  function handleMobileSectionChange(nextSection: MobileOverviewSection) {
    setActiveMobileSection(nextSection);
    requestAnimationFrame(() => {
      detailSectionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <section className="page admin-page">
      <h2 className="visually-hidden">{copy.title}</h2>

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
          label={copy.tenantTotal}
          value={state.tenants.length}
          meta={<AdminActionLink href="/dashboard/tenant-management">{copy.viewUsers}</AdminActionLink>}
        />
        <AdminMetricCard
          label={copy.activeTenants}
          value={state.activityOverview?.kpis.activeTenants7d ?? '-'}
          meta={<span>{copy.retention7d}: {formatPercent(state.activityOverview?.kpis.tenantRetention7d ?? null)}</span>}
        />
        <AdminMetricCard
          label={copy.monthlyActiveUsers}
          value={state.activityOverview?.kpis.mau ?? '-'}
          meta={<span>{copy.wau}: {state.activityOverview?.kpis.wau ?? '-'} · {copy.dau}: {state.activityOverview?.kpis.dau ?? '-'}</span>}
        />
        <AdminMetricCard
          label={copy.monthlyRevenue}
          value={formatCurrency(state.revenueOverview?.kpis.mrrCents ?? null, locale)}
          meta={<span>{copy.payingTenants}: {state.revenueOverview?.kpis.payingTenantCount ?? '-'}</span>}
        />
        <AdminMetricCard
          label={copy.totalStorage}
          value={formatBytes(state.usageOverview?.summary.totalStorageBytes ?? null)}
          meta={<span>{copy.nearLimit}: {state.usageOverview?.summary.nearLimitTenantCount ?? '-'} · {copy.exceeded}: {state.usageOverview?.summary.exceededTenantCount ?? '-'}</span>}
        />
        <AdminMetricCard label={copy.expiringSoon} value={expiringSoonTenants.length} />
        <AdminMetricCard label={copy.noOwner} value={noOwnerCount} />
        <AdminMetricCard
          label={copy.recentOps}
          value={state.logs.length}
          meta={<AdminActionLink href="/dashboard/audit-logs">{copy.viewRecords}</AdminActionLink>}
        />
      </div>

      <div ref={detailSectionsRef} className="data-overview-grid">
        <AdminPanel className={`stack data-overview-panel${activeMobileSection === 'trend' ? ' is-active' : ''}`}>
          <div className="admin-section-head">
            <h3>{copy.trendTitle}</h3>
            <p>{copy.trendDesc}</p>
          </div>

          <div className="data-overview-micro-grid">
            <div className="data-overview-micro-card">
              <span>{copy.dau}</span>
              <strong>{state.activityOverview?.kpis.dau ?? '-'}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{copy.wau}</span>
              <strong>{state.activityOverview?.kpis.wau ?? '-'}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{copy.mau}</span>
              <strong>{state.activityOverview?.kpis.mau ?? '-'}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{copy.retention7d}</span>
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
                <span>{copy.dau}: {item.dau}</span>
                <span>{copy.activeUsers7d}: {item.activeTenants}</span>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel className={`stack data-overview-panel${activeMobileSection === 'revenue' ? ' is-active' : ''}`}>
          <div className="admin-section-head">
            <h3>{copy.revenueTitle}</h3>
            <p>{copy.revenueDesc}</p>
          </div>

          <div className="data-overview-list">
            {(state.revenueOverview?.planBreakdown ?? []).map((plan) => (
              <div key={plan.plan} className="data-overview-row">
                <div className="stack row-tight">
                  <strong>{formatPlanLabel(plan.plan)}</strong>
                  <span className="muted">{copy.payingTenants}: {plan.payingTenantCount}</span>
                </div>
                <AdminBadge tone={plan.plan === 'PRO' ? 'accent' : plan.plan === 'BASIC' ? 'info' : 'neutral'}>
                  {formatCurrency(plan.mrrCents, locale)}
                </AdminBadge>
              </div>
            ))}
          </div>

          <div className="stack row-tight">
            <strong>{copy.upcomingRenewals}</strong>
            {expiringSoonTenants.length === 0 ? <p className="muted">{copy.noneUpcoming}</p> : null}
            <div className="data-overview-list">
              {expiringSoonTenants.map((tenant) => (
                <div key={tenant.id} className="data-overview-row">
                  <div className="stack row-tight">
                    <strong>{tenant.name}</strong>
                    <span className="mono">{tenant.slug}</span>
                  </div>
                  <AdminActionLink href={`/dashboard/tenants/${tenant.id}`}>{copy.viewTenant}</AdminActionLink>
                </div>
              ))}
            </div>
          </div>
        </AdminPanel>

        <AdminPanel className={`stack data-overview-panel${activeMobileSection === 'usage' ? ' is-active' : ''}`}>
          <div className="admin-section-head">
            <h3>{copy.usageTitle}</h3>
            <p>{copy.usageDesc}</p>
          </div>

          <div className="data-overview-micro-grid">
            <div className="data-overview-micro-card">
              <span>{copy.totalStorage}</span>
              <strong>{formatBytes(state.usageOverview?.summary.totalStorageBytes ?? null)}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{copy.nearLimit}</span>
              <strong>{state.usageOverview?.summary.nearLimitTenantCount ?? '-'}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{copy.exceeded}</span>
              <strong>{state.usageOverview?.summary.exceededTenantCount ?? '-'}</strong>
            </div>
            <div className="data-overview-micro-card">
              <span>{copy.payingTenants}</span>
              <strong>{state.revenueOverview?.kpis.payingTenantCount ?? '-'}</strong>
            </div>
          </div>

          <div className="stack row-tight">
            <strong>{copy.topStorage}</strong>
            {(state.usageOverview?.topTenants.length ?? 0) === 0 ? <p className="muted">{copy.noneTopStorage}</p> : null}
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
            <h3>{copy.recordsTitle}</h3>
            <p>{copy.recordsDesc}</p>
          </div>

          {state.logs.length === 0 ? <p className="muted">{copy.noAudit}</p> : null}
          {state.logs.length > 0 ? (
            <>
              <div className="data-record-list">
                {state.logs.map((log) => (
                  <article key={`mobile-${log.id}`} className="data-record-item">
                    <div className="data-record-head">
                      <strong>{formatAuditActionLabel(log.action)}</strong>
                      <span className="data-record-time">{formatDateTime(log.createdAt)}</span>
                    </div>
                    <div className="data-record-grid">
                      <div className="stack row-tight">
                        <span className="data-record-label">{copy.actor}</span>
                        <span>{log.actorUserEmail ?? '-'}</span>
                        <span className="mono">{log.actorUserId}</span>
                      </div>
                      <div className="stack row-tight">
                        <span className="data-record-label">{copy.tenant}</span>
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
                      <th>{copy.action}</th>
                      <th>{copy.actor}</th>
                      <th>{copy.tenant}</th>
                      <th>{copy.time}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.logs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatAuditActionLabel(log.action)}</td>
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

      {state.loading ? <p className="muted">{copy.loading}</p> : null}
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
