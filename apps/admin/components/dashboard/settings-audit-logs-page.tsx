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

import {
  AdminBadge,
  AdminPanel,
  AdminTableFrame
} from '@/components/dashboard/polish-primitives';
import { formatAuditActionLabel } from '@/lib/admin-labels';
import { apiRequest } from '@/lib/api-client';
import { formatDateTime, formatUnknownError } from '@/lib/formatters';

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
const EXPORT_ROW_LIMIT = 2000;
const actionOptions = Object.values(SuperAdminAuditAction);

export default function DashboardAuditLogsPage() {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
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

  useEffect(() => {
    if (!isFilterDrawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterDrawerOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterDrawerOpen]);

  const canGoPrevious = useMemo(() => state.page > 1, [state.page]);
  const canGoNext = useMemo(() => state.page < state.totalPages, [state.page, state.totalPages]);
  const appliedFilterCount = useMemo(() => countAppliedFilters(filtersApplied), [filtersApplied]);
  const appliedFilterChips = useMemo(
    () =>
      buildAppliedFilterChips(filtersApplied, {
        tenants,
        users
      }),
    [filtersApplied, tenants, users]
  );

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFiltersApplied(filtersDraft);
    setState((previous) => ({ ...previous, page: 1 }));
    setIsFilterDrawerOpen(false);
  }

  function handleResetFilters() {
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
    setIsFilterDrawerOpen(false);
  }

  return (
    <section className="page admin-page settings-audit-page">
      <h2 className="visually-hidden">设置</h2>

      <AdminPanel className="stack settings-mobile-hero">
        <div className="stack row-tight settings-mobile-hero-copy">
          <span className="admin-eyebrow">平台设置</span>
          <h3>操作记录</h3>
          <p>快速查看平台级治理动作，并按目标、操作者、动作与时间范围筛选。</p>
        </div>

        <div className="settings-mobile-summary" aria-label="设置概览">
          <div className="settings-mobile-stat">
            <span className="settings-mobile-stat-label">日志数</span>
            <strong className="settings-mobile-stat-value">{state.total}</strong>
          </div>
          <div className="settings-mobile-stat">
            <span className="settings-mobile-stat-label">当前页</span>
            <strong className="settings-mobile-stat-value">
              {state.page}/{Math.max(state.totalPages, 1)}
            </strong>
          </div>
          <div className="settings-mobile-stat">
            <span className="settings-mobile-stat-label">筛选项</span>
            <strong className="settings-mobile-stat-value">{appliedFilterCount}</strong>
          </div>
        </div>

        {appliedFilterChips.length > 0 ? (
          <div className="settings-filter-summary" aria-label="当前筛选摘要">
            {appliedFilterChips.map((chip) => (
              <span key={chip} className="settings-filter-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted settings-mobile-summary-note">当前未应用筛选，展示最新平台操作记录。</p>
        )}
      </AdminPanel>

      {isFilterDrawerOpen ? (
        <button
          data-ui="button"
          type="button"
          className="settings-filter-backdrop"
          aria-label="关闭筛选器"
          onClick={() => setIsFilterDrawerOpen(false)}
        />
      ) : null}

      <AdminPanel className={`stack admin-filter-panel settings-filter-panel${isFilterDrawerOpen ? ' is-open' : ''}`}>
        <div className="settings-filter-panel-head">
          <div className="admin-section-head">
            <h3>筛选器</h3>
            <p>导出与翻页都会复用当前条件，最多导出 {EXPORT_ROW_LIMIT} 行。</p>
          </div>
          <button
            data-ui="button"
            type="button"
            className="dashboard-bottom-dock-close settings-filter-panel-close"
            aria-label="关闭筛选器"
            onClick={() => setIsFilterDrawerOpen(false)}
          >
            ×
          </button>
        </div>

        <form className="stack" onSubmit={handleFilterSubmit}>
          <div className="form-grid filter-grid settings-filter-grid">
            <div className="stack">
              <label htmlFor="audit-tenant">目标用户</label>
              <select
                id="audit-tenant"
                name="tenantId"
                autoComplete="off"
                value={filtersDraft.tenantId}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({ ...previous, tenantId: event.target.value }))
                }
              >
                <option value="">全部用户</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </option>
                ))}
              </select>
            </div>

            <div className="stack">
              <label htmlFor="audit-user">操作者</label>
              <select
                id="audit-user"
                name="actorUserId"
                autoComplete="off"
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
                name="action"
                autoComplete="off"
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
                    {formatAuditActionLabel(action)}（{action}）
                  </option>
                ))}
              </select>
            </div>

            <div className="stack">
              <label htmlFor="audit-from">开始时间</label>
              <input
                id="audit-from"
                name="from"
                type="datetime-local"
                autoComplete="off"
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
                name="to"
                type="datetime-local"
                autoComplete="off"
                value={filtersDraft.to}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({ ...previous, to: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="inline-actions settings-filter-actions">
            <button type="submit">应用筛选</button>
            <button className="secondary" type="button" onClick={handleResetFilters}>
              重置
            </button>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel className="stack settings-log-panel">
        <div className="admin-section-head settings-log-panel-head">
          <div className="stack row-tight">
            <h3>操作记录</h3>
            <p>
              总数：{state.total} · 第 {state.page}/{state.totalPages} 页
            </p>
          </div>
          {appliedFilterCount > 0 ? <AdminBadge tone="info">已筛选 {appliedFilterCount} 项</AdminBadge> : null}
        </div>

        {state.loading ? <p className="muted" aria-live="polite">加载审计日志中…</p> : null}
        {!state.loading && state.logs.length === 0 ? <p className="muted">当前筛选条件下暂无日志。</p> : null}

        {state.logs.length > 0 ? (
          <>
            <div className="settings-audit-mobile-list">
              {state.logs.map((log) => {
                const metadataText = stringifyMetadata(log.metadata);

                return (
                  <article key={log.id} className="settings-audit-card">
                    <div className="stack row-tight settings-audit-card-main">
                      <div className="inline-actions settings-audit-card-badges">
                        <AdminBadge tone={toAuditTone(log.action)}>{formatAuditActionLabel(log.action)}</AdminBadge>
                        <span className="settings-audit-card-time">{formatCompactDateTime(log.createdAt)}</span>
                      </div>
                      <span className="mono settings-audit-card-action">{log.action}</span>
                    </div>

                    <div className="settings-audit-card-grid">
                      <div className="settings-audit-card-field">
                        <span className="settings-audit-card-label">操作者</span>
                        <strong className="settings-audit-card-value">{log.actorUserEmail ?? '系统'}</strong>
                        <span className="mono settings-audit-card-meta">{log.actorUserId}</span>
                      </div>
                      <div className="settings-audit-card-field">
                        <span className="settings-audit-card-label">目标</span>
                        <strong className="settings-audit-card-value">{log.targetTenantSlug ?? '平台级日志'}</strong>
                        <span className="mono settings-audit-card-meta">{log.targetTenantId ?? '无目标用户'}</span>
                      </div>
                    </div>

                    {metadataText !== '-' ? (
                      <details className="settings-audit-metadata">
                        <summary>查看元数据</summary>
                        <pre>{metadataText}</pre>
                      </details>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <AdminTableFrame className="settings-audit-table-frame">
              <thead>
                <tr>
                  <th>动作</th>
                  <th>操作者</th>
                  <th>目标用户</th>
                  <th>元数据</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {state.logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="stack row-tight">
                        <span>{formatAuditActionLabel(log.action)}</span>
                        <span className="mono">{log.action}</span>
                      </div>
                    </td>
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
          </>
        ) : null}

        <div className="inline-actions settings-pagination-bar">
          <p className="settings-pagination-summary">
            第 {state.page}/{Math.max(state.totalPages, 1)} 页
          </p>
          <div className="inline-actions settings-pagination-actions">
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
        </div>
      </AdminPanel>

      {!isFilterDrawerOpen ? (
        <button
          data-ui="button"
          type="button"
          className="settings-filter-fab"
          aria-expanded={false}
          aria-label={appliedFilterCount > 0 ? `打开筛选器，当前已应用 ${appliedFilterCount} 项筛选` : '打开筛选器'}
          onClick={() => setIsFilterDrawerOpen(true)}
        >
          <span className="settings-filter-fab-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M4 5.5h12M6.5 10h7M8.5 14.5h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <span className="settings-filter-fab-label">筛选</span>
          {appliedFilterCount > 0 ? <span className="settings-filter-fab-badge">{appliedFilterCount}</span> : null}
        </button>
      ) : null}

      {state.error ? <p className="error">{state.error}</p> : null}
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

function countAppliedFilters(filters: AuditFilters) {
  return Object.values(filters).filter(Boolean).length;
}

function buildAppliedFilterChips(
  filters: AuditFilters,
  context: {
    tenants: AdminTenant[];
    users: AdminUser[];
  }
) {
  const chips: string[] = [];
  const tenant = context.tenants.find((item) => item.id === filters.tenantId);
  const actor = context.users.find((item) => item.id === filters.actorUserId);

  if (tenant) {
    chips.push(`目标：${tenant.name}`);
  }
  if (actor) {
    chips.push(`操作者：${actor.email}`);
  }
  if (filters.action) {
    chips.push(`动作：${formatAuditActionLabel(filters.action)}`);
  }
  if (filters.from) {
    chips.push(`开始：${formatCompactDateTime(filters.from)}`);
  }
  if (filters.to) {
    chips.push(`结束：${formatCompactDateTime(filters.to)}`);
  }

  return chips;
}

function stringifyMetadata(metadata: unknown) {
  if (metadata === null || typeof metadata === 'undefined') {
    return '-';
  }

  try {
    return JSON.stringify(metadata, null, 2);
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

function formatCompactDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const now = new Date();
  const showYear = parsed.getFullYear() !== now.getFullYear();

  return new Intl.DateTimeFormat('zh-CN', {
    ...(showYear ? { year: '2-digit' } : {}),
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsed);
}

function toAuditTone(action: SuperAdminAuditActionType): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' {
  if (
    action === SuperAdminAuditAction.CreateTenant ||
    action === SuperAdminAuditAction.CreateSubscriptionActivationCode
  ) {
    return 'accent';
  }

  if (
    action === SuperAdminAuditAction.UpdateTenantSubscription ||
    action === SuperAdminAuditAction.ReactivateTenantLifecycle ||
    action === SuperAdminAuditAction.UpsertTenantMember
  ) {
    return 'info';
  }

  if (action === SuperAdminAuditAction.SuspendTenantLifecycle) {
    return 'warning';
  }

  if (
    action === SuperAdminAuditAction.OffboardTenantLifecycle ||
    action === SuperAdminAuditAction.RemoveTenantMember
  ) {
    return 'danger';
  }

  if (
    action === SuperAdminAuditAction.GetActivityOverview ||
    action === SuperAdminAuditAction.GetRevenueOverview ||
    action === SuperAdminAuditAction.GetUsageOverview ||
    action === SuperAdminAuditAction.GetTenantUsage
  ) {
    return 'success';
  }

  return 'neutral';
}
