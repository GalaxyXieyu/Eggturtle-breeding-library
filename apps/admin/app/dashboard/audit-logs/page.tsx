'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  listAdminTenantsResponseSchema,
  listSuperAdminAuditLogsResponseSchema,
  type SuperAdminAuditLog,
  type Tenant
} from '@eggturtle/shared';

import { ApiError, apiRequest } from '../../../lib/api-client';

type PageState = {
  loading: boolean;
  error: string | null;
  logs: SuperAdminAuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 20;

export default function DashboardAuditLogsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantFilter, setTenantFilter] = useState('');
  const [state, setState] = useState<PageState>({
    loading: true,
    error: null,
    logs: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 1
  });

  useEffect(() => {
    let cancelled = false;

    async function loadTenants() {
      try {
        const response = await apiRequest('/admin/tenants', {
          responseSchema: listAdminTenantsResponseSchema
        });

        if (!cancelled) {
          setTenants(response.tenants);
        }
      } catch {
        if (!cancelled) {
          setTenants([]);
        }
      }
    }

    void loadTenants();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      setState((previous) => ({ ...previous, loading: true, error: null }));
      try {
        const query = new URLSearchParams({
          page: String(state.page),
          pageSize: String(state.pageSize)
        });

        if (tenantFilter) {
          query.set('tenantId', tenantFilter);
        }

        const response = await apiRequest(`/admin/audit-logs?${query.toString()}`, {
          responseSchema: listSuperAdminAuditLogsResponseSchema
        });

        if (cancelled) {
          return;
        }

        setState((previous) => ({
          ...previous,
          loading: false,
          error: null,
          logs: response.logs,
          total: response.total,
          page: response.page,
          pageSize: response.pageSize,
          totalPages: response.totalPages
        }));
      } catch (error) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            loading: false,
            error: formatError(error),
            logs: []
          }));
        }
      }
    }

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [state.page, state.pageSize, tenantFilter]);

  const canGoPrevious = useMemo(() => state.page > 1, [state.page]);
  const canGoNext = useMemo(() => state.page < state.totalPages, [state.page, state.totalPages]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState((previous) => ({ ...previous, page: 1 }));
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Audit Logs</h2>
        <p>Track super-admin actions with tenant and actor IDs.</p>
      </header>

      <form className="card stack" onSubmit={handleFilterSubmit}>
        <h3>Filters</h3>
        <div className="inline-actions">
          <label htmlFor="audit-tenant">Tenant</label>
          <select
            id="audit-tenant"
            value={tenantFilter}
            onChange={(event) => setTenantFilter(event.target.value)}
          >
            <option value="">All tenants</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.slug})
              </option>
            ))}
          </select>
          <button type="submit">Apply</button>
        </div>
      </form>

      <article className="card stack">
        <h3>Events</h3>
        <p className="muted">
          Total: {state.total} · Page {state.page}/{state.totalPages}
        </p>

        {state.logs.length === 0 ? <p className="muted">No audit events found.</p> : null}
        {state.logs.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Tenant</th>
                <th>Metadata</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {state.logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.action}</td>
                  <td className="mono">{log.actorUserId}</td>
                  <td className="mono">{log.targetTenantId ?? '-'}</td>
                  <td className="mono">{stringifyMetadata(log.metadata)}</td>
                  <td>{formatDate(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <div className="inline-actions">
          <button
            className="secondary"
            type="button"
            disabled={!canGoPrevious}
            onClick={() => setState((previous) => ({ ...previous, page: Math.max(1, previous.page - 1) }))}
          >
            Previous
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!canGoNext}
            onClick={() =>
              setState((previous) => ({ ...previous, page: Math.min(previous.totalPages, previous.page + 1) }))
            }
          >
            Next
          </button>
        </div>
      </article>

      {state.loading ? <p className="muted">Loading audit logs...</p> : null}
      {state.error ? <p className="error">{state.error}</p> : null}
    </section>
  );
}

function stringifyMetadata(metadata: unknown) {
  if (metadata === null || typeof metadata === 'undefined') {
    return '-';
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return '[unserializable]';
  }
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
