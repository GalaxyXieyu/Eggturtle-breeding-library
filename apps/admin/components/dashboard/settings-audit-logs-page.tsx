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
import { useUiPreferences } from '@/components/ui-preferences';
import { formatAuditActionLabel } from '@/lib/admin-labels';
import { apiRequest } from '@/lib/api-client';
import { formatDateTime, formatUnknownError } from '@/lib/formatters';
import { SETTINGS_AUDIT_MESSAGES } from '@/lib/locales/settings-pages';

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
  const { locale } = useUiPreferences();
  const messages = SETTINGS_AUDIT_MESSAGES[locale];
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
            error: formatUnknownError(error, { fallback: messages.unknownError, locale }),
            logs: []
          }));
        }
      }
    }

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [filtersApplied, locale, messages.unknownError, state.page, state.pageSize]);

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
        users,
        locale,
        messages
      }),
    [filtersApplied, locale, messages, tenants, users]
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
      <h2 className="visually-hidden">{messages.pageTitle}</h2>

      <AdminPanel className="stack settings-mobile-hero">
        <div className="stack row-tight settings-mobile-hero-copy">
          <span className="admin-eyebrow">{messages.mobileEyebrow}</span>
          <h3>{messages.mobileTitle}</h3>
          <p>{messages.mobileDesc}</p>
        </div>

        <div className="settings-mobile-summary" aria-label={messages.mobileSummary}>
          <div className="settings-mobile-stat">
            <span className="settings-mobile-stat-label">{messages.totalLogs}</span>
            <strong className="settings-mobile-stat-value">{state.total}</strong>
          </div>
          <div className="settings-mobile-stat">
            <span className="settings-mobile-stat-label">{messages.currentPage}</span>
            <strong className="settings-mobile-stat-value">
              {state.page}/{Math.max(state.totalPages, 1)}
            </strong>
          </div>
          <div className="settings-mobile-stat">
            <span className="settings-mobile-stat-label">{messages.filterCount}</span>
            <strong className="settings-mobile-stat-value">{appliedFilterCount}</strong>
          </div>
        </div>

        {appliedFilterChips.length > 0 ? (
          <div className="settings-filter-summary" aria-label={messages.activeFilters}>
            {appliedFilterChips.map((chip) => (
              <span key={chip} className="settings-filter-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted settings-mobile-summary-note">{messages.noActiveFilters}</p>
        )}
      </AdminPanel>

      {isFilterDrawerOpen ? (
        <button
          data-ui="button"
          type="button"
          className="settings-filter-backdrop"
          aria-label={messages.closeFilters}
          onClick={() => setIsFilterDrawerOpen(false)}
        />
      ) : null}

      <AdminPanel className={`stack admin-filter-panel settings-filter-panel${isFilterDrawerOpen ? ' is-open' : ''}`}>
        <div className="settings-filter-panel-head">
          <div className="admin-section-head">
            <h3>{messages.filterTitle}</h3>
            <p>{messages.filterDesc(EXPORT_ROW_LIMIT)}</p>
          </div>
          <button
            data-ui="button"
            type="button"
            className="dashboard-bottom-dock-close settings-filter-panel-close"
            aria-label={messages.closeFilters}
            onClick={() => setIsFilterDrawerOpen(false)}
          >
            ×
          </button>
        </div>

        <form className="stack" onSubmit={handleFilterSubmit}>
          <div className="form-grid filter-grid settings-filter-grid">
            <div className="stack">
              <label htmlFor="audit-tenant">{messages.targetTenant}</label>
              <select
                id="audit-tenant"
                name="tenantId"
                autoComplete="off"
                value={filtersDraft.tenantId}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({ ...previous, tenantId: event.target.value }))
                }
              >
                <option value="">{messages.allUsers}</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </option>
                ))}
              </select>
            </div>

            <div className="stack">
              <label htmlFor="audit-user">{messages.actor}</label>
              <select
                id="audit-user"
                name="actorUserId"
                autoComplete="off"
                value={filtersDraft.actorUserId}
                onChange={(event) =>
                  setFiltersDraft((previous) => ({ ...previous, actorUserId: event.target.value }))
                }
              >
                <option value="">{messages.allUsers}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="stack">
              <label htmlFor="audit-action">{messages.action}</label>
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
                <option value="">{messages.allActions}</option>
                {actionOptions.map((action) => (
                  <option key={action} value={action}>
                    {formatAuditActionLabel(action, locale)} ({action})
                  </option>
                ))}
              </select>
            </div>

            <div className="stack">
              <label htmlFor="audit-from">{messages.from}</label>
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
              <label htmlFor="audit-to">{messages.to}</label>
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
            <button type="submit">{messages.applyFilters}</button>
            <button className="secondary" type="button" onClick={handleResetFilters}>
              {messages.resetFilters}
            </button>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel className="stack settings-log-panel">
        <div className="admin-section-head settings-log-panel-head">
          <div className="stack row-tight">
            <h3>{messages.mobileTitle}</h3>
            <p>
              {messages.logsSummary(state.total, state.page, state.totalPages)}
            </p>
          </div>
          {appliedFilterCount > 0 ? <AdminBadge tone="info">{messages.filtersAppliedBadge(appliedFilterCount)}</AdminBadge> : null}
        </div>

        {state.loading ? <p className="muted" aria-live="polite">{messages.loading}</p> : null}
        {!state.loading && state.logs.length === 0 ? <p className="muted">{messages.empty}</p> : null}

        {state.logs.length > 0 ? (
          <>
            <div className="settings-audit-mobile-list">
              {state.logs.map((log) => {
                const metadataText = stringifyMetadata(log.metadata, messages);

                return (
                  <article key={log.id} className="settings-audit-card">
                    <div className="stack row-tight settings-audit-card-main">
                      <div className="inline-actions settings-audit-card-badges">
                        <AdminBadge tone={toAuditTone(log.action)}>{formatAuditActionLabel(log.action, locale)}</AdminBadge>
                        <span className="settings-audit-card-time">{formatCompactDateTime(log.createdAt, locale)}</span>
                      </div>
                      <span className="mono settings-audit-card-action">{log.action}</span>
                    </div>

                    <div className="settings-audit-card-grid">
                      <div className="settings-audit-card-field">
                        <span className="settings-audit-card-label">{messages.actorLabel}</span>
                        <strong className="settings-audit-card-value">{log.actorUserEmail ?? messages.systemActor}</strong>
                        <span className="mono settings-audit-card-meta">{log.actorUserId}</span>
                      </div>
                      <div className="settings-audit-card-field">
                        <span className="settings-audit-card-label">{messages.targetLabel}</span>
                        <strong className="settings-audit-card-value">{log.targetTenantSlug ?? messages.platformLog}</strong>
                        <span className="mono settings-audit-card-meta">{log.targetTenantId ?? messages.noTargetTenant}</span>
                      </div>
                    </div>

                    {metadataText !== '-' ? (
                      <details className="settings-audit-metadata">
                        <summary>{messages.metadataSummary}</summary>
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
                  <th>{messages.thAction}</th>
                  <th>{messages.thActor}</th>
                  <th>{messages.thTargetTenant}</th>
                  <th>{messages.thMetadata}</th>
                  <th>{messages.thTime}</th>
                </tr>
              </thead>
              <tbody>
                {state.logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="stack row-tight">
                        <span>{formatAuditActionLabel(log.action, locale)}</span>
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
                    <td className="mono metadata-cell">{stringifyMetadata(log.metadata, messages)}</td>
                    <td>{formatDateTime(log.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTableFrame>
          </>
        ) : null}

        <div className="inline-actions settings-pagination-bar">
          <p className="settings-pagination-summary">
            {messages.pagination(state.page, Math.max(state.totalPages, 1))}
          </p>
          <div className="inline-actions settings-pagination-actions">
            <button
              className="secondary"
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setState((previous) => ({ ...previous, page: Math.max(1, previous.page - 1) }))}
            >
              {messages.previousPage}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={!canGoNext}
              onClick={() =>
                setState((previous) => ({ ...previous, page: Math.min(previous.totalPages, previous.page + 1) }))
              }
            >
              {messages.nextPage}
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
          aria-label={appliedFilterCount > 0 ? messages.openFiltersWithCount(appliedFilterCount) : messages.openFilters}
          onClick={() => setIsFilterDrawerOpen(true)}
        >
          <span className="settings-filter-fab-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M4 5.5h12M6.5 10h7M8.5 14.5h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <span className="settings-filter-fab-label">{messages.filterFabLabel}</span>
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
    locale: 'zh' | 'en';
    messages: (typeof SETTINGS_AUDIT_MESSAGES)[keyof typeof SETTINGS_AUDIT_MESSAGES];
  }
) {
  const chips: string[] = [];
  const tenant = context.tenants.find((item) => item.id === filters.tenantId);
  const actor = context.users.find((item) => item.id === filters.actorUserId);

  if (tenant) {
    chips.push(context.messages.chipTarget(tenant.name));
  }
  if (actor) {
    chips.push(context.messages.chipActor(actor.email));
  }
  if (filters.action) {
    chips.push(context.messages.chipAction(formatAuditActionLabel(filters.action, context.locale)));
  }
  if (filters.from) {
    chips.push(context.messages.chipFrom(formatCompactDateTime(filters.from, context.locale)));
  }
  if (filters.to) {
    chips.push(context.messages.chipTo(formatCompactDateTime(filters.to, context.locale)));
  }

  return chips;
}

function stringifyMetadata(metadata: unknown, messages: (typeof SETTINGS_AUDIT_MESSAGES)[keyof typeof SETTINGS_AUDIT_MESSAGES]) {
  if (metadata === null || typeof metadata === 'undefined') {
    return '-';
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return messages.metadataUnavailable;
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

function formatCompactDateTime(value: string, locale: 'zh' | 'en') {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const now = new Date();
  const showYear = parsed.getFullYear() !== now.getFullYear();

  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
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
