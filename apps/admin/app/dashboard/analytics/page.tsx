'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AdminActivityOverviewResponse, AdminActivityOverviewWindow } from '@eggturtle/shared';

import {
  AdminMetricCard,
  AdminPageHeader,
  AdminPanel,
  AdminTableFrame
} from '../../../components/dashboard/polish-primitives';
import { useUiPreferences } from '../../../components/ui-preferences';
import { getAdminActivityOverview } from '../../../lib/api-client';
import { formatUnknownError } from '../../../lib/formatters';

type PageState = {
  loading: boolean;
  error: string | null;
  data: AdminActivityOverviewResponse | null;
};

const COPY = {
  zh: {
    eyebrow: '数据分析',
    title: '活跃度看板',
    description: '按窗口查看 DAU/WAU/MAU、活跃租户和 7 天留存，支持回溯趋势与口径说明。',
    metricDau: 'DAU',
    metricWau: 'WAU',
    metricMau: 'MAU',
    metricActiveTenants: '活跃租户(7d)',
    metricRetention: '租户留存(7d)',
    retentionMeta: '前 7 天活跃且最近 7 天仍活跃',
    trendTitle: '按日趋势',
    trendDesc: '用于观察活跃波动与租户健康度变化。',
    thDate: '日期',
    thDau: 'DAU',
    thActiveTenants: '活跃租户',
    thDauTrend: 'DAU 趋势',
    thTenantTrend: '租户趋势',
    definitionsTitle: '指标口径',
    loading: '加载活跃度数据中...',
    empty: '暂无活跃度数据。',
    unknownError: '加载活跃度数据失败。'
  },
  en: {
    eyebrow: 'Platform Analytics',
    title: 'Activity Analytics',
    description: 'Track DAU/WAU/MAU, active tenants, and 7-day retention with trend visibility and metric definitions.',
    metricDau: 'DAU',
    metricWau: 'WAU',
    metricMau: 'MAU',
    metricActiveTenants: 'Active Tenants (7d)',
    metricRetention: 'Tenant Retention (7d)',
    retentionMeta: 'Tenants active in previous 7d and still active in latest 7d',
    trendTitle: 'Daily Trend',
    trendDesc: 'Monitor engagement shifts and tenant health over time.',
    thDate: 'Date',
    thDau: 'DAU',
    thActiveTenants: 'Active Tenants',
    thDauTrend: 'DAU Trend',
    thTenantTrend: 'Tenant Trend',
    definitionsTitle: 'Metric Definitions',
    loading: 'Loading activity analytics...',
    empty: 'No activity data available.',
    unknownError: 'Failed to load activity analytics.'
  }
} as const;

export default function DashboardAnalyticsPage() {
  const { locale } = useUiPreferences();
  const copy = COPY[locale];
  const [window, setWindow] = useState<AdminActivityOverviewWindow>('30d');
  const [state, setState] = useState<PageState>({
    loading: true,
    error: null,
    data: null
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((previous) => ({
        ...previous,
        loading: true,
        error: null
      }));

      try {
        const response = await getAdminActivityOverview({ window });
        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: null,
          data: response
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: formatUnknownError(error, { fallback: copy.unknownError }),
          data: null
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [copy.unknownError, window]);

  const trendScaleMax = useMemo(() => {
    if (!state.data || state.data.trend.length === 0) {
      return 1;
    }

    return Math.max(
      1,
      ...state.data.trend.flatMap((row) => [row.dau, row.activeTenants])
    );
  }, [state.data]);

  return (
    <section className="page admin-page">
      <AdminPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={(
          <div className="inline-actions">
            <button
              className={window === '7d' ? undefined : 'secondary'}
              type="button"
              onClick={() => setWindow('7d')}
            >
              7d
            </button>
            <button
              className={window === '30d' ? undefined : 'secondary'}
              type="button"
              onClick={() => setWindow('30d')}
            >
              30d
            </button>
          </div>
        )}
      />

      {state.loading ? <p className="muted">{copy.loading}</p> : null}
      {!state.loading && !state.data ? <p className="muted">{copy.empty}</p> : null}

      {state.data ? (
        <>
          <div className="admin-metrics-grid">
            <AdminMetricCard label={copy.metricDau} value={state.data.kpis.dau} />
            <AdminMetricCard label={copy.metricWau} value={state.data.kpis.wau} />
            <AdminMetricCard label={copy.metricMau} value={state.data.kpis.mau} />
            <AdminMetricCard
              label={copy.metricActiveTenants}
              value={state.data.kpis.activeTenants7d}
            />
            <AdminMetricCard
              label={copy.metricRetention}
              value={formatPercent(state.data.kpis.tenantRetention7d)}
              meta={copy.retentionMeta}
            />
          </div>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{copy.trendTitle}</h3>
              <p>{copy.trendDesc}</p>
            </div>
            <AdminTableFrame>
              <thead>
                <tr>
                  <th>{copy.thDate}</th>
                  <th>{copy.thDau}</th>
                  <th>{copy.thActiveTenants}</th>
                  <th>{copy.thDauTrend}</th>
                  <th>{copy.thTenantTrend}</th>
                </tr>
              </thead>
              <tbody>
                {state.data.trend.map((item) => (
                  <tr key={item.date}>
                    <td className="mono">{item.date}</td>
                    <td>{item.dau}</td>
                    <td>{item.activeTenants}</td>
                    <td>
                      <div className="admin-trend-bar">
                        <span style={{ width: `${(item.dau / trendScaleMax) * 100}%` }} />
                      </div>
                    </td>
                    <td>
                      <div className="admin-trend-bar">
                        <span style={{ width: `${(item.activeTenants / trendScaleMax) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTableFrame>
          </AdminPanel>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{copy.definitionsTitle}</h3>
            </div>
            <p className="muted">{state.data.definitions.activeTenant}</p>
            <p className="muted">{state.data.definitions.tenantRetention7d}</p>
          </AdminPanel>
        </>
      ) : null}

      {state.error ? <p className="error">{state.error}</p> : null}
    </section>
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
