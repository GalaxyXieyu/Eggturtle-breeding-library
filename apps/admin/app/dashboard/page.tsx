'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listAdminTenantsResponseSchema,
  listSuperAdminAuditLogsResponseSchema,
  type AdminTenant,
  type SuperAdminAuditLog
} from '@eggturtle/shared';

import { ApiError, apiRequest } from '../../lib/api-client';

type OverviewState = {
  loading: boolean;
  error: string | null;
  tenants: AdminTenant[];
  logs: SuperAdminAuditLog[];
};

export default function DashboardOverviewPage() {
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
          setState((previous) => ({ ...previous, loading: false, error: formatError(error) }));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page">
      <header className="page-header">
        <h2>Dashboard Overview</h2>
        <p>Cross-tenant controls live under `/admin/*` and are available only to allowlisted users.</p>
      </header>

      <div className="grid">
        <article className="card stack">
          <h3>Total tenants</h3>
          <p>
            <span className="badge">{state.tenants.length}</span>
          </p>
          <Link className="nav-link" href="/dashboard/tenants">
            Manage tenants
          </Link>
        </article>

        <article className="card stack">
          <h3>Recent super-admin events</h3>
          <p>
            <span className="badge">{state.logs.length}</span>
          </p>
          <Link className="nav-link" href="/dashboard/audit-logs">
            Open audit logs
          </Link>
        </article>
      </div>

      <article className="card stack">
        <h3>Latest audit events</h3>
        {state.logs.length === 0 ? <p className="muted">No audit events yet.</p> : null}
        {state.logs.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Tenant</th>
                <th>Created</th>
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

      {state.loading ? <p className="muted">Loading overview...</p> : null}
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

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}
