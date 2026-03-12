'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AdminActivityOverviewResponse, AdminActivityOverviewWindow } from '@eggturtle/shared';

import {
  AdminMetricCard,
  AdminPageHeader,
  AdminPanel,
  AdminTableFrame
} from '@/components/dashboard/polish-primitives';
import { useUiPreferences } from '@/components/ui-preferences';
import { getAdminActivityOverview } from '@/lib/api-client';
import { formatUnknownError } from '@/lib/formatters';
import { DASHBOARD_ANALYTICS_MESSAGES } from '@/lib/locales/dashboard-pages';

type PageState = {
  loading: boolean;
  error: string | null;
  data: AdminActivityOverviewResponse | null;
};

export default function DashboardAnalyticsPage() {
  const { locale } = useUiPreferences();
  const messages = DASHBOARD_ANALYTICS_MESSAGES[locale];
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
        eyebrow={messages.eyebrow}
        title={messages.title}
        description={messages.description}
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

      {state.loading ? <p className="muted">{messages.loading}</p> : null}
      {!state.loading && !state.data ? <p className="muted">{messages.empty}</p> : null}

      {state.data ? (
        <>
          <div className="admin-metrics-grid">
            <AdminMetricCard label={messages.metricDau} value={state.data.kpis.dau} />
            <AdminMetricCard label={messages.metricWau} value={state.data.kpis.wau} />
            <AdminMetricCard label={messages.metricMau} value={state.data.kpis.mau} />
            <AdminMetricCard
              label={messages.metricActiveTenants}
              value={state.data.kpis.activeTenants7d}
            />
            <AdminMetricCard
              label={messages.metricRetention}
              value={formatPercent(state.data.kpis.tenantRetention7d)}
              meta={messages.retentionMeta}
            />
          </div>

          <AdminPanel className="stack">
            <div className="admin-section-head">
              <h3>{messages.trendTitle}</h3>
              <p>{messages.trendDesc}</p>
            </div>
            <AdminTableFrame>
              <thead>
                <tr>
                  <th>{messages.thDate}</th>
                  <th>{messages.thDau}</th>
                  <th>{messages.thActiveTenants}</th>
                  <th>{messages.thDauTrend}</th>
                  <th>{messages.thTenantTrend}</th>
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
              <h3>{messages.definitionsTitle}</h3>
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
