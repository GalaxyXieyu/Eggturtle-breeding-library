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

const COPY = {
  zh: {
    eyebrow: '用量分析',
    title: '用量看板',
    description: '聚合跨用户 TopN 与单用户明细，优先定位配额风险与异常增长。',
    topNLabel: '展示数量',
    top5: '前 5 名',
    top10: '前 10 名',
    top20: '前 20 名',
    metricTenants: '用户总数',
    metricNearLimit: '逼近阈值用户',
    metricExceeded: '已超限用户',
    metricStorage: '总存储',
    metricStorageMeta: '按 product_images.size_bytes 汇总',
    rankTitle: '跨用户 TopN',
    rankDesc: '按配额利用率最高值排序，支持快速定位风险用户。',
    thTenant: '用户',
    thPlan: '套餐',
    thScore: '风险分值',
    thAlerts: '告警',
    thActions: '操作',
    select: '查看明细',
    detailTitle: '用户明细',
    detailDesc: '展示产品、图片、分享与存储的使用情况及阈值状态。',
    metricType: '指标',
    metricUsed: '已用',
    metricLimit: '上限',
    metricUtilization: '利用率',
    metricStatus: '状态',
    loading: '加载用量概览中...',
    tenantLoading: '加载用户明细中...',
    empty: '暂无可展示的用户用量数据。',
    unknownError: '加载用量数据失败。'
  },
  en: {
    eyebrow: 'Tenant Usage',
    title: 'Usage Analytics',
    description: 'Track cross-tenant TopN and drill into per-tenant usage to catch quota risks early.',
    topNLabel: 'TopN',
    top5: 'Top 5',
    top10: 'Top 10',
    top20: 'Top 20',
    metricTenants: 'Total Tenants',
    metricNearLimit: 'Near Limit Tenants',
    metricExceeded: 'Exceeded Tenants',
    metricStorage: 'Total Storage',
    metricStorageMeta: 'Aggregated from product_images.size_bytes',
    rankTitle: 'Cross-Tenant TopN',
    rankDesc: 'Sorted by highest quota utilization score for quick risk triage.',
    thTenant: 'Tenant',
    thPlan: 'Plan',
    thScore: 'Risk Score',
    thAlerts: 'Alerts',
    thActions: 'Action',
    select: 'View Details',
    detailTitle: 'Tenant Details',
    detailDesc: 'Shows products/images/shares/storage usage with threshold status.',
    metricType: 'Metric',
    metricUsed: 'Used',
    metricLimit: 'Limit',
    metricUtilization: 'Utilization',
    metricStatus: 'Status',
    loading: 'Loading usage overview...',
    tenantLoading: 'Loading tenant details...',
    empty: 'No tenant usage data available.',
    unknownError: 'Failed to load usage analytics.'
  }
} as const;

export default function DashboardUsagePage() {
  const { locale } = useUiPreferences();
  const copy = COPY[locale];
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
          error: formatUnknownError(error, { fallback: copy.unknownError }),
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
  }, [copy.unknownError, topN]);

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
          error: formatUnknownError(error, { fallback: copy.unknownError }),
          data: null
        });
      }
    }

    void loadTenantDetail();

    return () => {
      cancelled = true;
    };
  }, [copy.unknownError, selectedTenantId]);

  return (
    <section className="page admin-page">
      <AdminPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={(
          <div className="inline-actions">
            <label htmlFor="usage-topn-select">{copy.topNLabel}</label>
            <select
              id="usage-topn-select"
              value={topN}
              onChange={(event) => setTopN(Number(event.target.value))}
            >
              <option value={5}>{copy.top5}</option>
              <option value={10}>{copy.top10}</option>
              <option value={20}>{copy.top20}</option>
            </select>
          </div>
        )}
      />

      {overviewState.loading ? <p className="muted">{copy.loading}</p> : null}
      {!overviewState.loading && !overviewState.data ? <p className="muted">{copy.empty}</p> : null}

      {overviewState.data ? (
        <>
          <div className="admin-metrics-grid">
            <AdminMetricCard
              label={copy.metricTenants}
              value={overviewState.data.summary.tenantCount}
            />
            <AdminMetricCard
              label={copy.metricNearLimit}
              value={overviewState.data.summary.nearLimitTenantCount}
            />
            <AdminMetricCard
              label={copy.metricExceeded}
              value={overviewState.data.summary.exceededTenantCount}
            />
            <AdminMetricCard
              label={copy.metricStorage}
              value={formatBytes(overviewState.data.summary.totalStorageBytes)}
              meta={copy.metricStorageMeta}
            />
          </div>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{copy.rankTitle}</h3>
              <p>{copy.rankDesc}</p>
            </div>
            <AdminTableFrame>
              <thead>
                <tr>
                  <th>{copy.thTenant}</th>
                  <th>{copy.thPlan}</th>
                  <th>{copy.thScore}</th>
                  <th>{copy.thAlerts}</th>
                  <th>{copy.thActions}</th>
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
                      <AdminBadge tone="info">{formatPlanLabel(tenant.plan)}</AdminBadge>
                    </td>
                    <td>{tenant.usageScore.toFixed(2)}</td>
                    <td>
                      {tenant.alerts.length === 0 ? (
                        <AdminBadge tone="success">{formatUsageStatusLabel('ok')}</AdminBadge>
                      ) : (
                        tenant.alerts.map((alert) => (
                          <AdminBadge
                            key={`${tenant.tenantId}-${alert.metric}-${alert.status}`}
                            tone={alert.status === 'exceeded' ? 'danger' : 'warning'}
                          >
                            {formatUsageMetricLabel(alert.metric)} · {formatUsageStatusLabel(alert.status)}
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
                        {copy.select}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTableFrame>
          </AdminPanel>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{copy.detailTitle}</h3>
              <p>{copy.detailDesc}</p>
            </div>

            {tenantState.loading ? <p className="muted">{copy.tenantLoading}</p> : null}

            {tenantState.data ? (
              <AdminTableFrame>
                <thead>
                  <tr>
                    <th>{copy.metricType}</th>
                    <th>{copy.metricUsed}</th>
                    <th>{copy.metricLimit}</th>
                    <th>{copy.metricUtilization}</th>
                    <th>{copy.metricStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  <UsageCountRow label={formatUsageMetricLabel('products')} metric={tenantState.data.usage.products} />
                  <UsageCountRow label={formatUsageMetricLabel('images')} metric={tenantState.data.usage.images} />
                  <UsageCountRow label={formatUsageMetricLabel('shares')} metric={tenantState.data.usage.shares} />
                  <UsageStorageRow label={formatUsageMetricLabel('storageBytes')} metric={tenantState.data.usage.storageBytes} />
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

function UsageCountRow({ label, metric }: { label: string; metric: AdminUsageCountMetric }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{metric.used}</td>
      <td>{metric.limit === null ? '不限制' : metric.limit}</td>
      <td>
        <div className="admin-meter">
          <span style={{ width: `${toPercent(metric.utilization)}%` }} />
        </div>
        <p className="mono">{formatUtilization(metric.utilization)}</p>
      </td>
      <td>
        <AdminBadge tone={toUsageTone(metric.status)}>{formatUsageStatusLabel(metric.status)}</AdminBadge>
      </td>
    </tr>
  );
}

function UsageStorageRow({ label, metric }: { label: string; metric: AdminUsageStorageMetric }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{formatBytes(metric.usedBytes)}</td>
      <td>{metric.limitBytes === null ? '不限制' : formatBytes(metric.limitBytes)}</td>
      <td>
        <div className="admin-meter">
          <span style={{ width: `${toPercent(metric.utilization)}%` }} />
        </div>
        <p className="mono">{formatUtilization(metric.utilization)}</p>
      </td>
      <td>
        <AdminBadge tone={toUsageTone(metric.status)}>{formatUsageStatusLabel(metric.status)}</AdminBadge>
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

function formatUtilization(value: number | null) {
  if (value === null) {
    return '不限制';
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
