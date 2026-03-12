'use client';

import { useEffect, useState } from 'react';
import type {
  AdminTenantUsage,
  AdminUsageCountMetric,
  AdminUsageLimitStatus,
  AdminUsageOverviewResponse,
  AdminUsageStorageMetric
} from '@eggturtle/shared';

import {
  AdminBadge,
  AdminMetricCard,
  AdminPageHeader,
  AdminPanel,
  AdminTableFrame
} from '@/components/dashboard/polish-primitives';
import { useUiPreferences } from '@/components/ui-preferences';
import {
  getAdminTenantUsage,
  getAdminUsageOverview
} from '@/lib/api-client';
import {
  formatPlanLabel,
  formatUsageMetricLabel,
  formatUsageStatusLabel
} from '@/lib/admin-labels';
import { formatUnknownError } from '@/lib/formatters';
import { DASHBOARD_USAGE_MESSAGES } from '@/lib/locales/dashboard-pages';

type UsagePageState = {
  loading: boolean;
  error: string | null;
  data: AdminUsageOverviewResponse | null;
};

type TenantUsageState = {
  loading: boolean;
  error: string | null;
  data: AdminTenantUsage | null;
};

export default function DashboardUsagePage() {
  const { locale } = useUiPreferences();
  const messages = DASHBOARD_USAGE_MESSAGES[locale];
  const [topN, setTopN] = useState(10);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [overviewState, setOverviewState] = useState<UsagePageState>({
    loading: true,
    error: null,
    data: null
  });
  const [tenantState, setTenantState] = useState<TenantUsageState>({
    loading: false,
    error: null,
    data: null
  });

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      setOverviewState({
        loading: true,
        error: null,
        data: null
      });

      try {
        const response = await getAdminUsageOverview({ topN });
        if (cancelled) {
          return;
        }

        setOverviewState({
          loading: false,
          error: null,
          data: response
        });

        setSelectedTenantId((previous) => {
          if (previous && response.topTenants.some((item) => item.tenantId === previous)) {
            return previous;
          }
          return response.topTenants[0]?.tenantId ?? null;
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setOverviewState({
          loading: false,
          error: formatUnknownError(error, { fallback: messages.unknownError, locale }),
          data: null
        });
        setSelectedTenantId(null);
        setTenantState({
          loading: false,
          error: null,
          data: null
        });
      }
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, [locale, messages.unknownError, topN]);

  useEffect(() => {
    if (!selectedTenantId) {
      setTenantState({
        loading: false,
        error: null,
        data: null
      });
      return;
    }

    const tenantId = selectedTenantId;
    let cancelled = false;

    async function loadTenantDetail() {
      setTenantState((previous) => ({
        ...previous,
        loading: true,
        error: null
      }));

      try {
        const response = await getAdminTenantUsage(tenantId);
        if (cancelled) {
          return;
        }

        setTenantState({
          loading: false,
          error: null,
          data: response.tenant
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setTenantState({
          loading: false,
          error: formatUnknownError(error, { fallback: messages.unknownError, locale }),
          data: null
        });
      }
    }

    void loadTenantDetail();

    return () => {
      cancelled = true;
    };
  }, [locale, messages.unknownError, selectedTenantId]);

  return (
    <section className="page admin-page">
      <AdminPageHeader
        eyebrow={messages.eyebrow}
        title={messages.title}
        description={messages.description}
        actions={(
          <div className="inline-actions">
            <label htmlFor="usage-topn-select">{messages.topNLabel}</label>
            <select
              id="usage-topn-select"
              value={topN}
              onChange={(event) => setTopN(Number(event.target.value))}
            >
              <option value={5}>{messages.top5}</option>
              <option value={10}>{messages.top10}</option>
              <option value={20}>{messages.top20}</option>
            </select>
          </div>
        )}
      />

      {overviewState.loading ? <p className="muted">{messages.loading}</p> : null}
      {!overviewState.loading && !overviewState.data ? <p className="muted">{messages.empty}</p> : null}

      {overviewState.data ? (
        <>
          <div className="admin-metrics-grid">
            <AdminMetricCard
              label={messages.metricTenants}
              value={overviewState.data.summary.tenantCount}
            />
            <AdminMetricCard
              label={messages.metricNearLimit}
              value={overviewState.data.summary.nearLimitTenantCount}
            />
            <AdminMetricCard
              label={messages.metricExceeded}
              value={overviewState.data.summary.exceededTenantCount}
            />
            <AdminMetricCard
              label={messages.metricStorage}
              value={formatBytes(overviewState.data.summary.totalStorageBytes)}
              meta={messages.metricStorageMeta}
            />
          </div>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{messages.rankTitle}</h3>
              <p>{messages.rankDesc}</p>
            </div>
            <AdminTableFrame>
              <thead>
                <tr>
                  <th>{messages.thTenant}</th>
                  <th>{messages.thPlan}</th>
                  <th>{messages.thScore}</th>
                  <th>{messages.thAlerts}</th>
                  <th>{messages.thActions}</th>
                </tr>
              </thead>
              <tbody>
                {overviewState.data.topTenants.map((tenant) => (
                  <tr
                    key={tenant.tenantId}
                    className={tenant.tenantId === selectedTenantId ? 'is-selected' : undefined}
                  >
                    <td>
                      <strong>{tenant.tenantName}</strong>
                      <p className="mono">{tenant.tenantSlug}</p>
                    </td>
                    <td>
                      <AdminBadge tone="info">{formatPlanLabel(tenant.plan, locale)}</AdminBadge>
                    </td>
                    <td>{tenant.usageScore.toFixed(2)}</td>
                    <td>
                      {tenant.alerts.length === 0 ? (
                        <AdminBadge tone="success">{formatUsageStatusLabel('ok', locale)}</AdminBadge>
                      ) : (
                        tenant.alerts.map((alert) => (
                          <AdminBadge
                            key={`${tenant.tenantId}-${alert.metric}-${alert.status}`}
                            tone={alert.status === 'exceeded' ? 'danger' : 'warning'}
                          >
                            {formatUsageMetricLabel(alert.metric, locale)} · {formatUsageStatusLabel(alert.status, locale)}
                          </AdminBadge>
                        ))
                      )}
                    </td>
                    <td>
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => setSelectedTenantId(tenant.tenantId)}
                      >
                        {messages.select}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTableFrame>
          </AdminPanel>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{messages.detailTitle}</h3>
              <p>{messages.detailDesc}</p>
            </div>

            {tenantState.loading ? <p className="muted">{messages.tenantLoading}</p> : null}

            {tenantState.data ? (
              <AdminTableFrame>
                <thead>
                  <tr>
                    <th>{messages.metricType}</th>
                    <th>{messages.metricUsed}</th>
                    <th>{messages.metricLimit}</th>
                    <th>{messages.metricUtilization}</th>
                    <th>{messages.metricStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  <UsageCountRow
                    label={formatUsageMetricLabel('products', locale)}
                    metric={tenantState.data.usage.products}
                    locale={locale}
                    messages={messages}
                  />
                  <UsageCountRow
                    label={formatUsageMetricLabel('images', locale)}
                    metric={tenantState.data.usage.images}
                    locale={locale}
                    messages={messages}
                  />
                  <UsageCountRow
                    label={formatUsageMetricLabel('shares', locale)}
                    metric={tenantState.data.usage.shares}
                    locale={locale}
                    messages={messages}
                  />
                  <UsageStorageRow
                    label={formatUsageMetricLabel('storageBytes', locale)}
                    metric={tenantState.data.usage.storageBytes}
                    locale={locale}
                    messages={messages}
                  />
                </tbody>
              </AdminTableFrame>
            ) : null}
          </AdminPanel>
        </>
      ) : null}

      {overviewState.error ? <p className="error">{overviewState.error}</p> : null}
      {tenantState.error ? <p className="error">{tenantState.error}</p> : null}
    </section>
  );
}

function UsageCountRow({
  label,
  metric,
  locale,
  messages
}: {
  label: string;
  metric: AdminUsageCountMetric;
  locale: 'zh' | 'en';
  messages: (typeof DASHBOARD_USAGE_MESSAGES)[keyof typeof DASHBOARD_USAGE_MESSAGES];
}) {
  return (
    <tr>
      <td>{label}</td>
      <td>{metric.used}</td>
      <td>{metric.limit === null ? messages.noLimit : metric.limit}</td>
      <td>
        <div className="admin-meter">
          <span style={{ width: `${toPercent(metric.utilization)}%` }} />
        </div>
        <p className="mono">{formatUtilization(metric.utilization, messages)}</p>
      </td>
      <td>
        <AdminBadge tone={toUsageTone(metric.status)}>{formatUsageStatusLabel(metric.status, locale)}</AdminBadge>
      </td>
    </tr>
  );
}

function UsageStorageRow({
  label,
  metric,
  locale,
  messages
}: {
  label: string;
  metric: AdminUsageStorageMetric;
  locale: 'zh' | 'en';
  messages: (typeof DASHBOARD_USAGE_MESSAGES)[keyof typeof DASHBOARD_USAGE_MESSAGES];
}) {
  return (
    <tr>
      <td>{label}</td>
      <td>{formatBytes(metric.usedBytes)}</td>
      <td>{metric.limitBytes === null ? messages.noLimit : formatBytes(metric.limitBytes)}</td>
      <td>
        <div className="admin-meter">
          <span style={{ width: `${toPercent(metric.utilization)}%` }} />
        </div>
        <p className="mono">{formatUtilization(metric.utilization, messages)}</p>
      </td>
      <td>
        <AdminBadge tone={toUsageTone(metric.status)}>{formatUsageStatusLabel(metric.status, locale)}</AdminBadge>
      </td>
    </tr>
  );
}

function toPercent(value: number | null) {
  if (value === null) {
    return 0;
  }
  return Math.max(0, Math.min(100, value * 100));
}

function formatUtilization(value: number | null, messages: (typeof DASHBOARD_USAGE_MESSAGES)[keyof typeof DASHBOARD_USAGE_MESSAGES]) {
  if (value === null) {
    return messages.noLimit;
  }
  return `${(value * 100).toFixed(1)}%`;
}

function toUsageTone(status: AdminUsageLimitStatus): 'neutral' | 'warning' | 'danger' | 'success' {
  if (status === 'exceeded') {
    return 'danger';
  }
  if (status === 'near_limit') {
    return 'warning';
  }
  if (status === 'ok') {
    return 'success';
  }
  return 'neutral';
}

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return value;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let cursor = bytes;
  let unitIndex = 0;
  while (cursor >= 1024 && unitIndex < units.length - 1) {
    cursor /= 1024;
    unitIndex += 1;
  }

  return `${cursor.toFixed(cursor >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
