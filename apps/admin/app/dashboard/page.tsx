'use client';

import { useEffect, useState } from 'react';
import {
  listAdminTenantsResponseSchema,
  listSuperAdminAuditLogsResponseSchema,
  type AdminTenant,
  type SuperAdminAuditLog
} from '@eggturtle/shared';

import {
  AdminActionLink,
  AdminMetricCard,
  AdminPageHeader,
  AdminPanel,
  AdminTableFrame
} from '@/components/dashboard/polish-primitives';
import { useUiPreferences } from '@/components/ui-preferences';
import { apiRequest } from '@/lib/api-client';
import { formatDateTime, formatUnknownError } from '@/lib/formatters';

type ActivityOverview = {
  window: '7d' | '30d';
  kpis: {
    dau: number;
    wau: number;
    mau: number;
    activeTenants7d: number;
    tenantRetention7d: number;
  };
};

type RevenueOverview = {
  window: '30d' | '90d';
  kpis: {
    payingTenantCount: number;
    mrrCents: number;
    arrCents: number;
  };
  planBreakdown: {
    plan: 'FREE' | 'BASIC' | 'PRO';
    payingTenantCount: number;
  }[];
};

type UsageOverview = {
  summary: {
    totalStorageBytes: string;
    nearLimitTenantCount: number;
    exceededTenantCount: number;
  };
  topN: number;
  topTenants: {
    tenantSlug: string;
    usageScore: number;
  }[];
};

type OverviewState = {
  loading: boolean;
  error: string | null;
  tenants: AdminTenant[];
  logs: SuperAdminAuditLog[];
  activityOverview: ActivityOverview | null;
  revenueOverview: RevenueOverview | null;
  usageOverview: UsageOverview | null;
};

function formatCents(cents: number, locale: 'zh' | 'en') {
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

function formatBytes(bytes: string) {
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

const COPY = {
  zh: {
    pageTitle: '后台总览',
    pageDesc: '这里展示平台级用户与审计概况，仅白名单超级管理员可访问。',
    tenantTotal: '用户总数',
    openTenants: '打开用户管理',
    recentOps: '近期平台操作',
    openAudit: '打开审计日志',
    latestAudit: '最新审计记录',
    noAudit: '当前暂无审计记录。',
    activeUsers: '活跃用户',
    retention: '7日留存',
    revenue: '订阅收入（估算）',
    payingTenants: '付费用户数',
    openRevenue: '打开收入分析',
    storage: '存储使用',
    openUsage: '打开用量总览',
    thAction: '动作',
    thActor: '操作者',
    thTenant: '目标用户',
    thTime: '时间',
    loading: '加载总览中...',
    unknownError: '未知错误'
  },
  en: {
    pageTitle: 'Admin Overview',
    pageDesc: 'Platform-level tenant and audit summary for allowlisted super admins.',
    tenantTotal: 'Tenants',
    openTenants: 'Open tenant management',
    recentOps: 'Recent platform actions',
    openAudit: 'Open audit logs',
    latestAudit: 'Latest audit records',
    noAudit: 'No audit records yet.',
    activeUsers: 'Active users',
    retention: '7d retention',
    revenue: 'Subscription revenue (est.)',
    payingTenants: 'Paying tenants',
    openRevenue: 'Open revenue analytics',
    storage: 'Storage usage',
    openUsage: 'Open usage overview',
    thAction: 'Action',
    thActor: 'Actor',
    thTenant: 'Tenant',
    thTime: 'Time',
    loading: 'Loading overview...',
    unknownError: 'Unknown error'
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [tenantResponse, logResponse, activityResponse, revenueResponse, usageResponse] =
          await Promise.all([
            apiRequest('/admin/tenants', {
              responseSchema: listAdminTenantsResponseSchema
            }),
            apiRequest('/admin/audit-logs?page=1&pageSize=5', {
              responseSchema: listSuperAdminAuditLogsResponseSchema
            }),
            apiRequest('/admin/analytics/activity/overview?window=30d') as Promise<ActivityOverview>,
            apiRequest('/admin/analytics/revenue/overview?window=30d') as Promise<RevenueOverview>,
            apiRequest('/admin/analytics/usage/overview?topN=5') as Promise<UsageOverview>
          ]);

        if (cancelled) {
          return;
        }

        const activityOverview = activityResponse ?? null;
        const revenueOverview = revenueResponse ?? null;
        const usageOverview = usageResponse
          ? {
              ...usageResponse,
              topTenants: (usageResponse.topTenants ?? []).map((tenant) => ({
                tenantSlug: tenant.tenantSlug,
                usageScore: tenant.usageScore
              }))
            }
          : null;

        setState({
          loading: false,
          error: null,
          tenants: tenantResponse.tenants,
          logs: logResponse.logs,
          activityOverview: activityOverview as ActivityOverview | null,
          revenueOverview: revenueOverview as RevenueOverview | null,
          usageOverview: usageOverview as UsageOverview | null
        });
      } catch (error) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            loading: false,
            error: formatUnknownError(error, { fallback: copy.unknownError })
          }));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [copy.unknownError]);

  return (
    <section className="page admin-page">
      <AdminPageHeader eyebrow="平台总览" title={copy.pageTitle} description={copy.pageDesc} />

      <div className="admin-metrics-grid">
        <AdminMetricCard
          label={copy.tenantTotal}
          value={state.tenants.length}
          meta={(
            <AdminActionLink href="/dashboard/tenants">
              {copy.openTenants}
            </AdminActionLink>
          )}
        />
        <AdminMetricCard
          label={copy.activeUsers}
          value={state.activityOverview?.kpis?.mau ?? '-'}
          meta={(
            <div className="stack row-tight">
              <span>DAU: {state.activityOverview?.kpis?.dau ?? '-'}</span>
              <span>WAU: {state.activityOverview?.kpis?.wau ?? '-'}</span>
            </div>
          )}
        />
        <AdminMetricCard
          label={copy.retention}
          value={
            state.activityOverview?.kpis?.tenantRetention7d != null
              ? `${Math.round(state.activityOverview.kpis.tenantRetention7d * 100)}%`
              : '-'
          }
          meta={(
            <span className="muted">
              Active tenants (7d): {state.activityOverview?.kpis?.activeTenants7d ?? '-'}
            </span>
          )}
        />
        <AdminMetricCard
          label={copy.revenue}
          value={state.revenueOverview ? formatCents(state.revenueOverview.kpis.mrrCents ?? 0, locale) : '-'}
          meta={(
            <div className="stack row-tight">
              <span>
                {copy.payingTenants}: {state.revenueOverview?.kpis?.payingTenantCount ?? '-'}
              </span>
              <AdminActionLink href="/dashboard/analytics/revenue">
                {copy.openRevenue}
              </AdminActionLink>
            </div>
          )}
        />
        <AdminMetricCard
          label={copy.storage}
          value={state.usageOverview ? formatBytes(state.usageOverview.summary.totalStorageBytes ?? '0') : '-'}
          meta={(
            <div className="stack row-tight">
              <span>
                Near limit: {state.usageOverview?.summary?.nearLimitTenantCount ?? '-'} | Exceeded:{' '}
                {state.usageOverview?.summary?.exceededTenantCount ?? '-'}
              </span>
              <AdminActionLink href="/dashboard/usage">
                {copy.openUsage}
              </AdminActionLink>
            </div>
          )}
        />
        <AdminMetricCard
          label={copy.recentOps}
          value={state.logs.length}
          meta={(
            <AdminActionLink href="/dashboard/audit-logs">
              {copy.openAudit}
            </AdminActionLink>
          )}
        />
      </div>

      <AdminPanel className="stack">
        <div className="admin-section-head">
          <h3>{copy.latestAudit}</h3>
        </div>
        {state.logs.length === 0 ? <p className="muted">{copy.noAudit}</p> : null}
        {state.logs.length > 0 ? (
          <AdminTableFrame>
            <thead>
              <tr>
                <th>{copy.thAction}</th>
                <th>{copy.thActor}</th>
                <th>{copy.thTenant}</th>
                <th>{copy.thTime}</th>
              </tr>
            </thead>
            <tbody>
              {state.logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.action}</td>
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
        ) : null}
      </AdminPanel>

      {state.loading ? <p className="muted">{copy.loading}</p> : null}
      {state.error ? <p className="error">{state.error}</p> : null}
    </section>
  );
}
