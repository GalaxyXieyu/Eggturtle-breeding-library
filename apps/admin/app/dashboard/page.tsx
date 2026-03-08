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

type OverviewState = {
  loading: boolean;
  error: string | null;
  tenants: AdminTenant[];
  logs: SuperAdminAuditLog[];
};

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
    logs: []
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [tenantResponse, logResponse] = await Promise.all([
          apiRequest('/admin/tenants', {
            responseSchema: listAdminTenantsResponseSchema
          }),
          apiRequest('/admin/audit-logs?page=1&pageSize=5', {
            responseSchema: listSuperAdminAuditLogsResponseSchema
          })
        ]);

        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: null,
          tenants: tenantResponse.tenants,
          logs: logResponse.logs
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
