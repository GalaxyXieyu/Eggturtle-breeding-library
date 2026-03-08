'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AdminRevenueOverviewResponse,
  AdminRevenueOverviewWindow
} from '@eggturtle/shared';

import {
  AdminMetricCard,
  AdminPageHeader,
  AdminPanel,
  AdminTableFrame
} from '@/components/dashboard/polish-primitives';
import { formatPlanLabel } from '@/lib/admin-labels';
import { useUiPreferences } from '@/components/ui-preferences';
import { getAdminRevenueOverview } from '@/lib/api-client';
import { formatUnknownError } from '@/lib/formatters';

type RevenueState = {
  loading: boolean;
  error: string | null;
  data: AdminRevenueOverviewResponse | null;
};

const COPY = {
  zh: {
    eyebrow: '营收分析',
    title: '付费看板',
    description: '基于订阅套餐映射金额估算 MRR/ARR，并追踪升级、降级、流失趋势。',
    metricMrr: 'MRR',
    metricArr: 'ARR',
    metricPaying: '付费用户',
    metricActive: '活跃用户',
    metricUpgrade: '升级事件',
    metricDowngrade: '降级事件',
    metricChurn: '流失事件',
    metricReactivation: '恢复事件',
    planTitle: '套餐拆分',
    planDesc: '按当前活跃订阅估算月收入贡献。',
    trendTitle: '事件趋势',
    trendDesc: '升级/降级按连续套餐变更事件推断；流失/恢复来自生命周期操作。',
    thPlan: '套餐',
    thActive: '活跃用户',
    thPaying: '付费用户',
    thMrr: 'MRR',
    thDate: '日期',
    thUpgrade: '升级',
    thDowngrade: '降级',
    thChurn: '流失',
    thReactivation: '恢复',
    loading: '加载收入分析中...',
    empty: '暂无收入数据。',
    unknownError: '加载付费看板失败。'
  },
  en: {
    eyebrow: 'Revenue Analytics',
    title: 'Billing Analytics',
    description: 'Estimate MRR/ARR from plan price mapping and track upgrade, downgrade, and churn trends.',
    metricMrr: 'MRR',
    metricArr: 'ARR',
    metricPaying: 'Paying Tenants',
    metricActive: 'Active Tenants',
    metricUpgrade: 'Upgrades',
    metricDowngrade: 'Downgrades',
    metricChurn: 'Churns',
    metricReactivation: 'Reactivations',
    planTitle: 'Plan Breakdown',
    planDesc: 'Monthly revenue contribution estimated from current active subscriptions.',
    trendTitle: 'Event Trend',
    trendDesc: 'Upgrade/downgrade inferred from consecutive plan changes; churn/reactivation from lifecycle events.',
    thPlan: 'Plan',
    thActive: 'Active Tenants',
    thPaying: 'Paying Tenants',
    thMrr: 'MRR',
    thDate: 'Date',
    thUpgrade: 'Upgrades',
    thDowngrade: 'Downgrades',
    thChurn: 'Churns',
    thReactivation: 'Reactivations',
    loading: 'Loading revenue analytics...',
    empty: 'No revenue data available.',
    unknownError: 'Failed to load billing analytics.'
  }
} as const;

export default function DashboardBillingPage() {
  const { locale } = useUiPreferences();
  const copy = COPY[locale];
  const [window, setWindow] = useState<AdminRevenueOverviewWindow>('30d');
  const [state, setState] = useState<RevenueState>({
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
        const response = await getAdminRevenueOverview({ window });
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

  const maxTrendValue = useMemo(() => {
    if (!state.data || state.data.trend.length === 0) {
      return 1;
    }

    return Math.max(
      1,
      ...state.data.trend.flatMap((item) => [
        item.upgrades,
        item.downgrades,
        item.churns,
        item.reactivations
      ])
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
              className={window === '30d' ? undefined : 'secondary'}
              type="button"
              onClick={() => setWindow('30d')}
            >
              30d
            </button>
            <button
              className={window === '90d' ? undefined : 'secondary'}
              type="button"
              onClick={() => setWindow('90d')}
            >
              90d
            </button>
          </div>
        )}
      />

      {state.loading ? <p className="muted">{copy.loading}</p> : null}
      {!state.loading && !state.data ? <p className="muted">{copy.empty}</p> : null}

      {state.data ? (
        <>
          <div className="admin-metrics-grid">
            <AdminMetricCard label={copy.metricMrr} value={formatCurrency(state.data.kpis.mrrCents)} />
            <AdminMetricCard label={copy.metricArr} value={formatCurrency(state.data.kpis.arrCents)} />
            <AdminMetricCard label={copy.metricPaying} value={state.data.kpis.payingTenantCount} />
            <AdminMetricCard label={copy.metricActive} value={state.data.kpis.activeTenantCount} />
            <AdminMetricCard label={copy.metricUpgrade} value={state.data.kpis.upgradeEvents} />
            <AdminMetricCard label={copy.metricDowngrade} value={state.data.kpis.downgradeEvents} />
            <AdminMetricCard label={copy.metricChurn} value={state.data.kpis.churnEvents} />
            <AdminMetricCard label={copy.metricReactivation} value={state.data.kpis.reactivationEvents} />
          </div>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{copy.planTitle}</h3>
              <p>{copy.planDesc}</p>
            </div>
            <AdminTableFrame>
              <thead>
                <tr>
                  <th>{copy.thPlan}</th>
                  <th>{copy.thActive}</th>
                  <th>{copy.thPaying}</th>
                  <th>{copy.thMrr}</th>
                </tr>
              </thead>
              <tbody>
                {state.data.planBreakdown.map((item) => (
                  <tr key={item.plan}>
                    <td>
                      <div className="stack row-tight">
                        <span>{formatPlanLabel(item.plan)}</span>
                        <span className="mono muted">{item.plan}</span>
                      </div>
                    </td>
                    <td>{item.activeTenantCount}</td>
                    <td>{item.payingTenantCount}</td>
                    <td>{formatCurrency(item.mrrCents)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTableFrame>
          </AdminPanel>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{copy.trendTitle}</h3>
              <p>{copy.trendDesc}</p>
            </div>
            <AdminTableFrame>
              <thead>
                <tr>
                  <th>{copy.thDate}</th>
                  <th>{copy.thUpgrade}</th>
                  <th>{copy.thDowngrade}</th>
                  <th>{copy.thChurn}</th>
                  <th>{copy.thReactivation}</th>
                </tr>
              </thead>
              <tbody>
                {state.data.trend.map((item) => (
                  <tr key={item.date}>
                    <td className="mono">{item.date}</td>
                    <td>
                      <ValueWithTrendBar value={item.upgrades} max={maxTrendValue} />
                    </td>
                    <td>
                      <ValueWithTrendBar value={item.downgrades} max={maxTrendValue} />
                    </td>
                    <td>
                      <ValueWithTrendBar value={item.churns} max={maxTrendValue} />
                    </td>
                    <td>
                      <ValueWithTrendBar value={item.reactivations} max={maxTrendValue} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTableFrame>
          </AdminPanel>
        </>
      ) : null}

      {state.error ? <p className="error">{state.error}</p> : null}
    </section>
  );
}

function ValueWithTrendBar({ value, max }: { value: number; max: number }) {
  return (
    <div>
      <p>{value}</p>
      <div className="admin-trend-bar">
        <span style={{ width: `${(value / Math.max(max, 1)) * 100}%` }} />
      </div>
    </div>
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2
  }).format(cents / 100);
}
