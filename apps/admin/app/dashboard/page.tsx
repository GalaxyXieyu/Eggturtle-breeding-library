'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listAdminTenantsResponseSchema,
  listSuperAdminAuditLogsResponseSchema,
  type AdminTenant,
  type SuperAdminAuditLog
} from '@eggturtle/shared';

import { useUiPreferences } from '../../components/ui-preferences';
import { ApiError, apiRequest } from '../../lib/api-client';

type OverviewState = {
  loading: boolean;
  error: string | null;
  tenants: AdminTenant[];
  logs: SuperAdminAuditLog[];
};

const COPY = {
  zh: {
    pageTitle: '后台总览',
    pageDesc: '这里展示平台级租户与审计概况，仅白名单超级管理员可访问。',
    tenantTotal: '租户总数',
    openTenants: '打开租户管理',
    recentOps: '近期平台操作',
    openAudit: '打开审计日志',
    latestAudit: '最新审计记录',
    noAudit: '当前暂无审计记录。',
    thAction: '动作',
    thActor: '操作者',
    thTenant: '目标租户',
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
          setState((previous) => ({ ...previous, loading: false, error: formatError(error, copy.unknownError) }));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [copy.unknownError]);

  return (
    <section className="page">
      <header className="page-header">
        <h2>{copy.pageTitle}</h2>
        <p>{copy.pageDesc}</p>
      </header>

      <div className="grid">
        <article className="card stack">
          <h3>{copy.tenantTotal}</h3>
          <p>
            <span className="badge">{state.tenants.length}</span>
          </p>
          <Link className="nav-link" href="/dashboard/tenants">
            {copy.openTenants}
          </Link>
        </article>

        <article className="card stack">
          <h3>{copy.recentOps}</h3>
          <p>
            <span className="badge">{state.logs.length}</span>
          </p>
          <Link className="nav-link" href="/dashboard/audit-logs">
            {copy.openAudit}
          </Link>
        </article>
      </div>

      <article className="card stack">
        <h3>{copy.latestAudit}</h3>
        {state.logs.length === 0 ? <p className="muted">{copy.noAudit}</p> : null}
        {state.logs.length > 0 ? (
          <table className="data-table">
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
                  <td>{formatDate(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>

      {state.loading ? <p className="muted">{copy.loading}</p> : null}
      {state.error ? <p className="error">{state.error}</p> : null}
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
