'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  listAdminTenantMembersResponseSchema,
  listAdminTenantsResponseSchema,
  type AdminTenant,
  type AdminTenantInsights,
  type AdminTenantMember
} from '@eggturtle/shared'

import {
  AdminActionLink,
  AdminBadge,
  AdminPanel
} from '@/components/dashboard/polish-primitives'
import { useUiPreferences } from '@/components/ui-preferences'
import {
  formatBusinessAuditActionLabel,
  formatPlanLabel,
  formatSubscriptionStatusLabel,
  formatTenantRoleLabel
} from '@/lib/admin-labels'
import { apiRequest, getAdminTenantInsights } from '@/lib/api-client'
import { formatDateTime, formatUnknownError } from '@/lib/formatters'
import { TENANT_MANAGEMENT_MESSAGES } from '@/lib/locales/dashboard-pages'

type TenantScope = 'all' | 'paid' | 'expiring' | 'low-activity' | 'high-activity' | 'no-owner'

type TenantListState = {
  loading: boolean
  error: string | null
}

type SidePanelState = {
  loading: boolean
  error: string | null
}

const SCOPE_ORDER: TenantScope[] = [
  'all',
  'paid',
  'expiring',
  'low-activity',
  'high-activity',
  'no-owner'
]

export default function DashboardTenantManagementPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale } = useUiPreferences()
  const messages = TENANT_MANAGEMENT_MESSAGES[locale]

  const query = searchParams.get('q') ?? ''
  const scope = normalizeScope(searchParams.get('scope'))
  const selectedTenantId = searchParams.get('tenantId') ?? ''

  const [searchInput, setSearchInput] = useState(query)
  const [listState, setListState] = useState<TenantListState>({ loading: true, error: null })
  const [sidePanelState, setSidePanelState] = useState<SidePanelState>({ loading: false, error: null })
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [selectedInsights, setSelectedInsights] = useState<AdminTenantInsights | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<AdminTenantMember[]>([])
  const [isCompactViewport, setIsCompactViewport] = useState(false)

  useEffect(() => {
    setSearchInput(query)
  }, [locale, messages.unknownError, query])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const syncViewport = () => setIsCompactViewport(mediaQuery.matches)
    syncViewport()

    mediaQuery.addEventListener('change', syncViewport)
    return () => {
      mediaQuery.removeEventListener('change', syncViewport)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadTenants() {
      setListState({ loading: true, error: null })

      try {
        const params = new URLSearchParams()
        if (query.trim()) {
          params.set('search', query.trim())
        }

        const response = await apiRequest(`/admin/tenants${params.size ? `?${params.toString()}` : ''}`, {
          responseSchema: listAdminTenantsResponseSchema
        })

        if (cancelled) {
          return
        }

        setTenants(response.tenants)
        setListState({ loading: false, error: null })
      } catch (error) {
        if (cancelled) {
          return
        }

        setTenants([])
        setListState({ loading: false, error: formatUnknownError(error, { fallback: messages.unknownError, locale }) })
      }
    }

    void loadTenants()

    return () => {
      cancelled = true
    }
  }, [locale, messages.unknownError, query])

  const filteredTenants = useMemo(() => tenants.filter((tenant) => matchesScope(tenant, scope)), [tenants, scope])
  const selectedTenant = useMemo(() => {
    const explicitTenant = filteredTenants.find((tenant) => tenant.id === selectedTenantId) ?? null
    if (explicitTenant) {
      return explicitTenant
    }

    if (isCompactViewport) {
      return null
    }

    return filteredTenants[0] ?? null
  }, [filteredTenants, isCompactViewport, selectedTenantId])
  const selectedTenantKey = isCompactViewport ? null : selectedTenant?.id ?? null

  useEffect(() => {
    if (isCompactViewport || listState.loading) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())

    if (!selectedTenant && params.has('tenantId')) {
      params.delete('tenantId')
      router.replace(buildTenantManagementUrl(params))
      return
    }

    if (selectedTenant && selectedTenant.id !== selectedTenantId) {
      params.set('tenantId', selectedTenant.id)
      router.replace(buildTenantManagementUrl(params))
    }
  }, [isCompactViewport, listState.loading, router, searchParams, selectedTenant, selectedTenantId])

  useEffect(() => {
    if (!selectedTenantKey) {
      setSelectedInsights(null)
      setSelectedMembers([])
      return
    }

    const tenantKey: string = selectedTenantKey
    let cancelled = false

    async function loadSidePanel() {
      setSidePanelState({ loading: true, error: null })

      try {
        const [insightResponse, membersResponse] = await Promise.all([
          getAdminTenantInsights(tenantKey),
          apiRequest(`/admin/tenants/${tenantKey}/members`, {
            responseSchema: listAdminTenantMembersResponseSchema
          })
        ])

        if (cancelled) {
          return
        }

        setSelectedInsights(insightResponse.insights)
        setSelectedMembers(membersResponse.members)
        setSidePanelState({ loading: false, error: null })
      } catch (error) {
        if (cancelled) {
          return
        }

        setSelectedInsights(null)
        setSelectedMembers([])
        setSidePanelState({ loading: false, error: formatUnknownError(error, { fallback: messages.sideError, locale }) })
      }
    }

    void loadSidePanel()

    return () => {
      cancelled = true
    }
  }, [locale, messages.sideError, selectedTenantKey])

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    const nextQuery = searchInput.trim()

    if (nextQuery) {
      params.set('q', nextQuery)
    } else {
      params.delete('q')
    }

    params.delete('tenantId')
    router.replace(buildTenantManagementUrl(params))
  }

  function handleScopeChange(nextScope: TenantScope) {
    const params = new URLSearchParams(searchParams.toString())

    if (nextScope === 'all') {
      params.delete('scope')
    } else {
      params.set('scope', nextScope)
    }

    params.delete('tenantId')
    router.replace(buildTenantManagementUrl(params))
  }

  function handleTenantSelect(tenantId: string) {
    if (isCompactViewport) {
      router.push(`/dashboard/tenants/${tenantId}`)
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('tenantId', tenantId)
    router.replace(buildTenantManagementUrl(params))
  }

  const summaryMetrics = selectedInsights
    ? [
        {
          label: messages.metrics.currentPlan,
          value: formatPlanLabel(selectedInsights.tenant.subscription?.plan ?? 'FREE', locale)
        },
        {
          label: messages.metrics.expiresAt,
          value: formatExpiryCell(selectedInsights.tenant.subscription?.expiresAt ?? null, locale)
        },
        {
          label: messages.metrics.lastActiveAt,
          value: formatDateTimeCell(selectedInsights.tenant.lastActiveAt, locale)
        },
        { label: messages.metrics.totalProducts, value: String(selectedInsights.businessMetrics.totalProducts) },
        { label: messages.metrics.totalImages, value: String(selectedInsights.businessMetrics.totalImages) },
        {
          label: messages.metrics.storageUtilization,
          value: formatUtilization(selectedInsights.usage.usage.storageBytes.utilization)
        }
      ]
    : []

  return (
    <section className="page admin-page">
      <h2 className="visually-hidden">{messages.title}</h2>

      <AdminPanel className="stack governance-toolbar-panel">
        <form className="governance-toolbar" onSubmit={handleSearchSubmit}>
          <label className="visually-hidden" htmlFor="tenant-governance-search">
            {messages.searchPlaceholder}
          </label>
          <input
            id="tenant-governance-search"
            name="tenantSearch"
            type="search"
            autoComplete="off"
            aria-label={messages.searchPlaceholder}
            value={searchInput}
            placeholder={messages.searchPlaceholder}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit">{messages.searchAction}</button>
        </form>
        <div className="governance-scope-row">
          <div className="governance-scope-list">
            {SCOPE_ORDER.map((item) => (
              <button
                key={item}
                type="button"
                className={`governance-scope-chip${scope === item ? ' active' : ''}`}
                aria-pressed={scope === item}
                onClick={() => handleScopeChange(item)}
              >
                {messages.scopes[item]}
              </button>
            ))}
          </div>
          <span className="muted">
            {messages.resultCount}: {filteredTenants.length}
          </span>
        </div>
      </AdminPanel>

      <div className="tenant-governance-workbench">
        <AdminPanel className="stack tenant-governance-list-panel">
          <div className="admin-section-head">
            <h3>{messages.listTitle}</h3>
            <p>{messages.listDesc}</p>
          </div>

          {listState.loading ? <p className="muted">{messages.loading}</p> : null}
          {!listState.loading && filteredTenants.length === 0 ? <p className="muted">{messages.empty}</p> : null}
          {listState.error ? <p className="error">{listState.error}</p> : null}

          <div className="tenant-governance-list">
            {filteredTenants.map((tenant) => {
              const ownerLabel = tenant.owner?.account ?? tenant.owner?.email ?? messages.ownerMissing
              const isSelected = !isCompactViewport && tenant.id === selectedTenant?.id

              return (
                <button
                  key={tenant.id}
                  type="button"
                  className={`tenant-governance-item${isSelected ? ' active' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => handleTenantSelect(tenant.id)}
                >
                  <span className="tenant-governance-item-top">
                    <span className="stack row-tight tenant-governance-item-copy">
                      <strong>{tenant.name}</strong>
                      <span className="tenant-governance-subline">
                        <span className="mono">{tenant.slug}</span>
                        <span className="tenant-governance-owner" title={ownerLabel}>
                          {ownerLabel}
                        </span>
                      </span>
                    </span>
                    <span className="inline-actions">
                      <AdminBadge tone={toPlanTone(tenant.subscription?.plan ?? 'FREE')}>
                        {formatPlanLabel(tenant.subscription?.plan ?? 'FREE', locale)}
                      </AdminBadge>
                      <AdminBadge tone={toStatusTone(tenant.subscription?.status ?? 'ACTIVE')}>
                        {formatSubscriptionStatusLabel(tenant.subscription?.status ?? 'ACTIVE', locale)}
                      </AdminBadge>
                    </span>
                  </span>
                  <span className="tenant-governance-meta">
                    <span className="tenant-governance-stat">
                      <span className="tenant-governance-stat-label">{messages.createdAt}</span>
                      <strong className="tenant-governance-stat-value">
                        {formatCompactDateTime(tenant.createdAt, locale)}
                      </strong>
                    </span>
                    <span className="tenant-governance-stat">
                      <span className="tenant-governance-stat-label">{messages.lastActiveAt}</span>
                      <strong className="tenant-governance-stat-value">
                        {formatCompactDateTime(tenant.lastActiveAt, locale)}
                      </strong>
                    </span>
                  </span>
                  <span className="governance-tag-row">
                    {tenant.autoTags.slice(0, 2).map((tag) => (
                      <AdminBadge key={tag.key} tone={tag.tone}>
                        {tag.label}
                      </AdminBadge>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </AdminPanel>

        {!isCompactViewport ? (
          <AdminPanel className="stack tenant-governance-side-panel">
            <div className="admin-section-head">
              <h3>{messages.summaryTitle}</h3>
              <p>{messages.summaryDesc}</p>
            </div>

            {!selectedTenant ? <p className="muted">{messages.noSelection}</p> : null}
            {selectedTenant && sidePanelState.loading ? <p className="muted">{messages.sideLoading}</p> : null}
            {selectedTenant && sidePanelState.error ? <p className="error">{messages.sideError}: {sidePanelState.error}</p> : null}

            {selectedTenant && selectedInsights ? (
              <>
                <div className="tenant-side-hero">
                  <div className="stack row-tight">
                    <h3>{selectedInsights.tenant.name}</h3>
                    <p className="mono">{selectedInsights.tenant.slug}</p>
                    <p className="muted">
                      {selectedInsights.tenant.owner?.account ?? selectedInsights.tenant.owner?.email ?? messages.ownerMissing}
                    </p>
                  </div>
                  <div className="inline-actions">
                    <AdminBadge tone={toPlanTone(selectedInsights.tenant.subscription?.plan ?? 'FREE')}>
                      {formatPlanLabel(selectedInsights.tenant.subscription?.plan ?? 'FREE', locale)}
                    </AdminBadge>
                    <AdminBadge tone={toStatusTone(selectedInsights.tenant.subscription?.status ?? 'ACTIVE')}>
                      {formatSubscriptionStatusLabel(selectedInsights.tenant.subscription?.status ?? 'ACTIVE', locale)}
                    </AdminBadge>
                  </div>
                </div>

                <div className="stack row-tight">
                  <strong>{messages.allTags}</strong>
                  <div className="governance-tag-column">
                    {selectedInsights.autoTags.length === 0 ? <p className="muted">-</p> : null}
                    {selectedInsights.autoTags.map((tag) => (
                      <div key={tag.key} className="governance-tag-detail">
                        <AdminBadge tone={tag.tone}>{tag.label}</AdminBadge>
                        <span className="muted">{tag.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="tenant-side-metrics-grid">
                  {summaryMetrics.map((metric) => (
                    <div key={metric.label} className="tenant-side-metric-card">
                      <span className="tenant-side-metric-label">{metric.label}</span>
                      <strong className="tenant-side-metric-value">{metric.value}</strong>
                    </div>
                  ))}
                </div>

                <p className="muted">{messages.notes}</p>

                <div className="stack row-tight">
                  <strong>{messages.latestLogs}</strong>
                  {selectedInsights.recentBusinessLogs.slice(0, 5).length === 0 ? <p className="muted">{messages.noLogs}</p> : null}
                  <div className="tenant-side-feed">
                    {selectedInsights.recentBusinessLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="tenant-side-feed-item">
                        <div className="stack row-tight">
                          <strong>{formatBusinessAuditActionLabel(log.action, locale)}</strong>
                          <span className="muted">{log.resourceType}</span>
                        </div>
                        <div className="stack row-tight tenant-side-feed-meta">
                          <span>{formatDateTime(log.createdAt)}</span>
                          <span className="mono">{log.actorUserId}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="stack row-tight">
                  <strong>{messages.members}</strong>
                  {selectedMembers.length === 0 ? <p className="muted">{messages.noMembers}</p> : null}
                  <div className="tenant-side-member-list">
                    {selectedMembers.slice(0, 5).map((member) => (
                      <div key={`${member.tenantId}:${member.user.id}`} className="tenant-side-member-item">
                        <div className="stack row-tight">
                          <strong>{member.user.email}</strong>
                          <span className="muted">{member.user.name ?? '-'}</span>
                        </div>
                        <AdminBadge tone={toRoleTone(member.role)}>{formatTenantRoleLabel(member.role, locale)}</AdminBadge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="stack row-tight">
                  <strong>{messages.actions}</strong>
                  <div className="inline-actions">
                    <AdminActionLink href={`/dashboard/tenants/${selectedInsights.tenant.id}`}>
                      {messages.viewDetail}
                    </AdminActionLink>
                    <AdminActionLink href={`/dashboard/memberships?tenantId=${selectedInsights.tenant.id}`}>
                      {messages.openMembers}
                    </AdminActionLink>
                  </div>
                  <span className="muted">
                    {messages.createdAt}: {formatDateTime(selectedInsights.tenant.createdAt)}
                  </span>
                </div>
              </>
            ) : null}
          </AdminPanel>
        ) : null}
      </div>
    </section>
  )
}

function normalizeScope(value: string | null): TenantScope {
  if (
    value === 'paid' ||
    value === 'expiring' ||
    value === 'low-activity' ||
    value === 'high-activity' ||
    value === 'no-owner'
  ) {
    return value
  }

  return 'all'
}

function buildTenantManagementUrl(params: URLSearchParams) {
  const query = params.toString()
  return `/dashboard/tenant-management${query ? `?${query}` : ''}`
}

function matchesScope(tenant: AdminTenant, scope: TenantScope) {
  if (scope === 'all') {
    return true
  }

  if (scope === 'paid') {
    return tenant.subscription?.plan === 'BASIC' || tenant.subscription?.plan === 'PRO'
  }

  if (scope === 'expiring') {
    return tenant.autoTags.some((tag) => tag.key === 'expiring_soon')
  }

  if (scope === 'low-activity') {
    return tenant.autoTags.some((tag) => tag.key === 'low_activity' || tag.key === 'silent')
  }

  if (scope === 'high-activity') {
    return tenant.autoTags.some((tag) => tag.key === 'high_activity')
  }

  return tenant.autoTags.some((tag) => tag.key === 'no_owner')
}

function toPlanTone(plan: string): 'accent' | 'info' | 'neutral' {
  if (plan === 'PRO') {
    return 'accent'
  }

  if (plan === 'BASIC') {
    return 'info'
  }

  return 'neutral'
}

function toStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTIVE') {
    return 'success'
  }

  if (status === 'EXPIRED') {
    return 'warning'
  }

  if (status === 'DISABLED') {
    return 'danger'
  }

  return 'neutral'
}

function toRoleTone(role: string): 'accent' | 'info' | 'warning' | 'neutral' {
  if (role === 'OWNER') {
    return 'accent'
  }

  if (role === 'ADMIN') {
    return 'info'
  }

  if (role === 'EDITOR') {
    return 'warning'
  }

  return 'neutral'
}

function formatDateTimeCell(value: string | null, locale: 'zh' | 'en') {
  if (!value) {
    return locale === 'zh' ? '暂无' : '—'
  }

  return formatDateTime(value)
}

function formatExpiryCell(value: string | null, locale: 'zh' | 'en') {
  if (!value) {
    return locale === 'zh' ? '无到期' : 'No expiry'
  }

  return formatDateTime(value)
}

function formatCompactDateTime(value: string | null, locale: 'zh' | 'en') {
  if (!value) {
    return locale === 'zh' ? '暂无' : 'No activity'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const now = new Date()
  const showYear = date.getFullYear() !== now.getFullYear()

  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    ...(showYear ? { year: '2-digit' } : {}),
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatUtilization(value: number | null) {
  if (value === null) {
    return '∞'
  }

  return `${Math.round(value * 100)}%`
}
