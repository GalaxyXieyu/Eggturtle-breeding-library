'use client';

import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
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

import {
  AdminPageHeader,
  AdminPanel,
  AdminTableFrame
} from '../../../components/dashboard/polish-primitives';
import { apiRequest } from '../../../lib/api-client';
import { formatDateTime, formatUnknownError } from '../../../lib/formatters';

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

type ExportToast = {
  tone: 'info' | 'success' | 'error';
  message: string;
};

const DEFAULT_PAGE_SIZE = 20;
const EXPORT_ROW_LIMIT = 2000;
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
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<ExportToast | null>(null);

  useEffect(() => {
    if (!exportToast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setExportToast(null);
    }, 3200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [exportToast]);

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
        const query = buildAuditQuery(filtersApplied, {
          page: state.page,
          pageSize: state.pageSize
        });

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
            error: formatUnknownError(error),
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

  function showExportToast(tone: ExportToast['tone'], message: string) {
    setExportToast({ tone, message });
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFiltersApplied(filtersDraft);
    setState((previous) => ({ ...previous, page: 1 }));
    setExportMessage(null);
    setExportToast(null);
  }

  async function handleExportCsv() {
    if (exporting) {
      return;
    }

    setExporting(true);
    setExportMessage(null);
    showExportToast('info', '正在准备 CSV 导出...');

    try {
      const query = buildAuditQuery(filtersApplied, { limit: EXPORT_ROW_LIMIT });
      const response = await fetch(`/api/proxy/admin/audit-logs/export?${query.toString()}`, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(resolveExportErrorMessage(response.status));
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const filename = pickFilename(response.headers.get('content-disposition'));

      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      const truncated = response.headers.get('x-export-truncated') === '1';
      const message = truncated
        ? `CSV 已下载（数据量较大，已按上限 ${EXPORT_ROW_LIMIT} 行截断）`
        : 'CSV 已下载';

      setExportMessage(message);
      showExportToast('success', message);
    } catch (error) {
      const message = formatExportError(error);
      setExportMessage(message);
      showExportToast('error', message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="page admin-page">
      {exportToast ? (
        <div aria-live="polite" role="status" style={getToastStyle(exportToast.tone)}>
          {exportToast.message}
        </div>
      ) : null}

      <AdminPageHeader
        eyebrow="Audit Logs"
        title="审计日志"
        description="按租户、用户、动作和时间范围过滤平台级操作日志。"
        actions={
          <div className="inline-actions">
            <button className="secondary" type="button" onClick={() => void handleExportCsv()} disabled={exporting}>
              {exporting ? '导出中...' : '导出 CSV'}
            </button>
          </div>
        }
      />

      <AdminPanel className="stack admin-filter-panel">
        <div className="admin-section-head">
          <h3>筛选条件</h3>
          <p>导出会严格复用当前已应用的筛选条件，最多导出 {EXPORT_ROW_LIMIT} 行。</p>
        </div>

        <form className="stack" onSubmit={handleFilterSubmit}>
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
                setExportMessage(null);
                setExportToast(null);
              }}
            >
              重置
            </button>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel className="stack">
        <div className="admin-section-head">
          <h3>日志列表</h3>
          <p>
            总数：{state.total} · 第 {state.page}/{state.totalPages} 页
          </p>
        </div>

        {state.loading ? <p className="muted">加载审计日志中...</p> : null}
        {!state.loading && state.logs.length === 0 ? <p className="muted">当前筛选条件下暂无日志。</p> : null}

        {state.logs.length > 0 ? (
          <AdminTableFrame>
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
                  <td>{formatDateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </AdminTableFrame>
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
      </AdminPanel>

      {state.error ? <p className="error">{state.error}</p> : null}
      {exportMessage ? (
        <p className={exportMessage.includes('失败') || exportMessage.includes('错误') ? 'error' : 'success'}>
          {exportMessage}
        </p>
      ) : null}
    </section>
  );
}

function buildAuditQuery(
  filters: AuditFilters,
  pagination: {
    page?: number;
    pageSize?: number;
    limit?: number;
  }
) {
  const query = new URLSearchParams();

  if (typeof pagination.page === 'number') {
    query.set('page', String(pagination.page));
  }
  if (typeof pagination.pageSize === 'number') {
    query.set('pageSize', String(pagination.pageSize));
  }
  if (typeof pagination.limit === 'number') {
    query.set('limit', String(pagination.limit));
  }

  if (filters.tenantId) {
    query.set('tenantId', filters.tenantId);
  }
  if (filters.actorUserId) {
    query.set('actorUserId', filters.actorUserId);
  }
  if (filters.action) {
    query.set('action', filters.action);
  }

  const fromIso = toIso(filters.from);
  const toIsoValue = toIso(filters.to);
  if (fromIso) {
    query.set('from', fromIso);
  }
  if (toIsoValue) {
    query.set('to', toIsoValue);
  }

  return query;
}

function pickFilename(contentDisposition: string | null) {
  if (!contentDisposition) {
    return `audit-logs-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.csv`;
  }

  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (!match?.[1]) {
    return `audit-logs-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.csv`;
  }

  return match[1];
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

function resolveExportErrorMessage(status: number) {
  if (status === 401) {
    return '登录状态已失效，请重新登录后重试。';
  }

  if (status === 403) {
    return '当前账号无导出权限。';
  }

  if (status === 404) {
    return '导出接口暂不可用，请稍后重试。';
  }

  if (status === 429) {
    return '导出请求过于频繁，请稍后再试。';
  }

  if (status >= 500) {
    return '导出服务暂时不可用，请稍后重试。';
  }

  return `导出失败（${status}）`;
}

function formatExportError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.replace(/\s+/g, ' ').trim();

    if (!message) {
      return '导出失败，请稍后重试。';
    }

    if (message.toLowerCase() === 'failed to fetch') {
      return '网络异常，导出失败，请稍后重试。';
    }

    if (message.length > 120 || /stack|trace|exception/i.test(message)) {
      return '导出失败，请稍后重试。';
    }

    return message;
  }

  return '导出失败，请稍后重试。';
}

function getToastStyle(tone: ExportToast['tone']): CSSProperties {
  const backgroundByTone: Record<ExportToast['tone'], string> = {
    info: 'rgba(30, 41, 59, 0.96)',
    success: 'rgba(21, 128, 61, 0.96)',
    error: 'rgba(185, 28, 28, 0.96)'
  };

  return {
    position: 'fixed',
    top: '1rem',
    right: '1rem',
    zIndex: 50,
    maxWidth: 'min(28rem, calc(100vw - 2rem))',
    padding: '0.7rem 0.95rem',
    borderRadius: '0.75rem',
    color: '#fff',
    backgroundColor: backgroundByTone[tone],
    boxShadow: '0 14px 36px rgba(15, 23, 42, 0.28)',
    fontSize: '0.9rem',
    lineHeight: 1.4
  };
}
