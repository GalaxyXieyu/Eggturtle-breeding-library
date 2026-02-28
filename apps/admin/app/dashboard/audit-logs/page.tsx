'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  SuperAdminAuditAction,
  listAdminTenantsResponseSchema,
  listAdminUsersResponseSchema,
  listSuperAdminAuditLogsResponseSchema,
  type AdminTenant,
  type AdminUser,
  type SuperAdminAuditActionType,
  type SuperAdminAuditLog
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

type AuditFilters = {
  tenantId: string;
  actorUserId: string;
  action: SuperAdminAuditActionType | '';
  from: string;
  to: string;
};

const DEFAULT_PAGE_SIZE = 20;
const actionOptions = Object.values(SuperAdminAuditAction);

export default function DashboardAuditLogsPage() {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filtersDraft, setFiltersDraft] = useState<AuditFilters>({
    tenantId: '',
    actorUserId: '',
    action: '',
    from: '',
    to: ''
  });
  const [filtersApplied, setFiltersApplied] = useState<AuditFilters>({
    tenantId: '',
    actorUserId: '',
    action: '',
    from: '',
    to: ''
  });
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

    async function loadFilterData() {
      try {
        const [tenantResponse, userResponse] = await Promise.all([
          apiRequest('/admin/tenants', {
            responseSchema: listAdminTenantsResponseSchema
          }),
          apiRequest('/admin/users', {
            responseSchema: listAdminUsersResponseSchema
          })
        ]);

        if (cancelled) {
          return;
        }

        setTenants(tenantResponse.tenants);
        setUsers(userResponse.users);
      } catch {
        if (!cancelled) {
          setTenants([]);
          setUsers([]);
        }
      }
    }

    void loadFilterData();

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

        if (filtersApplied.tenantId) {
          query.set('tenantId', filtersApplied.tenantId);
        }
        if (filtersApplied.actorUserId) {
          query.set('actorUserId', filtersApplied.actorUserId);
        }
        if (filtersApplied.action) {
          query.set('action', filtersApplied.action);
        }

        const fromIso = toIso(filtersApplied.from);
        const toIsoValue = toIso(filtersApplied.to);
        if (fromIso) {
          query.set('from', fromIso);
        }
        if (toIsoValue) {
          query.set('to', toIsoValue);
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
  }, [filtersApplied, state.page, state.pageSize]);

  const canGoPrevious = useMemo(() => state.page > 1, [state.page]);
  const canGoNext = useMemo(() => state.page < state.totalPages, [state.page, state.totalPages]);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFiltersApplied(filtersDraft);
    setState((previous) => ({ ...previous, page: 1 }));
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>审计日志</h2>
        <p>按租户、用户、动作和时间范围过滤平台级操作日志。</p>
      </header>

      <form className="card stack" onSubmit={handleFilterSubmit}>
        <h3>筛选条件</h3>
        <div className="form-grid filter-grid">
          <div className="stack">
            <label htmlFor="audit-tenant">租户</label>
            <select
              id="audit-tenant"
              value={filtersDraft.tenantId}
              onChange={(event) =>
                setFiltersDraft((previous) => ({ ...previous, tenantId: event.target.value }))
              }
            >
              <option value="">全部租户</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="stack">
            <label htmlFor="audit-user">用户</label>
            <select
              id="audit-user"
              value={filtersDraft.actorUserId}
              onChange={(event) =>
                setFiltersDraft((previous) => ({ ...previous, actorUserId: event.target.value }))
              }
            >
              <option value="">全部用户</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
          </div>

          <div className="stack">
            <label htmlFor="audit-action">动作</label>
            <select
              id="audit-action"
              value={filtersDraft.action}
              onChange={(event) =>
                setFiltersDraft((previous) => ({
                  ...previous,
                  action: event.target.value as SuperAdminAuditActionType | ''
                }))
              }
            >
              <option value="">全部动作</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div className="stack">
            <label htmlFor="audit-from">开始时间</label>
            <input
              id="audit-from"
              type="datetime-local"
              value={filtersDraft.from}
              onChange={(event) =>
                setFiltersDraft((previous) => ({ ...previous, from: event.target.value }))
              }
            />
          </div>

          <div className="stack">
            <label htmlFor="audit-to">结束时间</label>
            <input
              id="audit-to"
              type="datetime-local"
              value={filtersDraft.to}
              onChange={(event) =>
                setFiltersDraft((previous) => ({ ...previous, to: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="inline-actions">
          <button type="submit">应用筛选</button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              const nextFilters: AuditFilters = {
                tenantId: '',
                actorUserId: '',
                action: '',
                from: '',
                to: ''
              };
              setFiltersDraft(nextFilters);
              setFiltersApplied(nextFilters);
              setState((previous) => ({ ...previous, page: 1 }));
            }}
          >
            重置
          </button>
        </div>
      </form>

      <article className="card stack">
        <h3>日志列表</h3>
        <p className="muted">
          总数：{state.total} · 第 {state.page}/{state.totalPages} 页
        </p>

        {state.loading ? <p className="muted">加载审计日志中...</p> : null}
        {!state.loading && state.logs.length === 0 ? (
          <p className="muted">当前筛选条件下暂无日志。</p>
        ) : null}

        {state.logs.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>动作</th>
                <th>操作者</th>
                <th>目标租户</th>
                <th>元数据</th>
                <th>时间</th>
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
                  <td className="mono metadata-cell">{stringifyMetadata(log.metadata)}</td>
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
            上一页
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!canGoNext}
            onClick={() =>
              setState((previous) => ({ ...previous, page: Math.min(previous.totalPages, previous.page + 1) }))
            }
          >
            下一页
          </button>
        </div>
      </article>

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
    return '[无法序列化]';
  }
}

function toIso(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
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

  return '未知错误';
}
