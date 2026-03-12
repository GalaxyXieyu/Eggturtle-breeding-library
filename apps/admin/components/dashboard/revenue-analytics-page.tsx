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
import { REVENUE_ANALYTICS_MESSAGES } from '@/lib/locales/dashboard-pages';

type RevenueState = {
  loading: boolean;
  error: string | null;
  data: AdminRevenueOverviewResponse | null;
};

export default function RevenueAnalyticsPage() {
  const { locale } = useUiPreferences();
  const messages = REVENUE_ANALYTICS_MESSAGES[locale];
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
          error: formatUnknownError(error, { fallback: messages.unknownError, locale }),
          data: null
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [locale, messages.unknownError, window]);

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

  const planRows = useMemo(() => {
    if (!state.data) {
      return [];
    }

    const revenueData = state.data;

    return revenueData.planBreakdown.map((item) => ({
      ...item,
      monthlyPriceCents: revenueData.priceBookMonthlyCents[item.plan] ?? 0
    }));
  }, [state.data]);

  return (
    <section className="page admin-page">
      <AdminPageHeader
        eyebrow={messages.eyebrow}
        title={messages.title}
        description={messages.description}
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

      {state.loading ? <p className="muted">{messages.loading}</p> : null}
      {!state.loading && !state.data ? <p className="muted">{messages.empty}</p> : null}

      {state.data ? (
        <>
          <div className="admin-metrics-grid">
            <AdminMetricCard label={messages.metricMrr} value={formatCurrency(state.data.kpis.mrrCents, locale)} />
            <AdminMetricCard label={messages.metricArr} value={formatCurrency(state.data.kpis.arrCents, locale)} />
            <AdminMetricCard label={messages.metricPaying} value={state.data.kpis.payingTenantCount} />
            <AdminMetricCard label={messages.metricActive} value={state.data.kpis.activeTenantCount} />
            <AdminMetricCard label={messages.metricUpgrade} value={state.data.kpis.upgradeEvents} />
            <AdminMetricCard label={messages.metricDowngrade} value={state.data.kpis.downgradeEvents} />
            <AdminMetricCard label={messages.metricChurn} value={state.data.kpis.churnEvents} />
            <AdminMetricCard label={messages.metricReactivation} value={state.data.kpis.reactivationEvents} />
          </div>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{messages.priceBookTitle}</h3>
              <p>{messages.priceBookDesc}</p>
            </div>
            <AdminTableFrame>
              <thead>
                <tr>
                  <th>{messages.thPlan}</th>
                  <th>{messages.thMonthlyPrice}</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map((item) => (
                  <tr key={`price-${item.plan}`}>
                    <td>
                      <div className="stack row-tight">
                        <span>{formatPlanLabel(item.plan, locale)}</span>
                        <span className="mono muted">{item.plan}</span>
                      </div>
                    </td>
                    <td>{formatCurrency(item.monthlyPriceCents, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTableFrame>
          </AdminPanel>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{messages.planTitle}</h3>
              <p>{messages.planDesc}</p>
            </div>
            <AdminTableFrame>
              <thead>
                <tr>
                  <th>{messages.thPlan}</th>
                  <th>{messages.thActive}</th>
                  <th>{messages.thPaying}</th>
                  <th>{messages.thMrr}</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map((item) => (
                  <tr key={item.plan}>
                    <td>
                      <div className="stack row-tight">
                        <span>{formatPlanLabel(item.plan, locale)}</span>
                        <span className="mono muted">{item.plan}</span>
                      </div>
                    </td>
                    <td>{item.activeTenantCount}</td>
                    <td>{item.payingTenantCount}</td>
                    <td>{formatCurrency(item.mrrCents, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTableFrame>
          </AdminPanel>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{messages.trendTitle}</h3>
              <p>{messages.trendDesc}</p>
            </div>
            <AdminTableFrame>
              <thead>
                <tr>
                  <th>{messages.thDate}</th>
                  <th>{messages.thUpgrade}</th>
                  <th>{messages.thDowngrade}</th>
                  <th>{messages.thChurn}</th>
                  <th>{messages.thReactivation}</th>
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

function formatCurrency(cents: number, locale: 'zh' | 'en') {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: locale === 'zh' ? 'CNY' : 'USD',
    maximumFractionDigits: 2
  }).format(cents / 100);
}
