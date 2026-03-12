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

type TenantScope = 'all' | 'paid' | 'expiring' | 'low-activity' | 'high-activity' | 'no-owner'

type TenantListState = {
  loading: boolean
  error: string | null
}

type SidePanelState = {
  loading: boolean
  error: string | null
}

const COPY = {
  zh: {
    eyebrow: '用户治理',
    title: '用户',
    description: '先找到用户，再进入详情页判断数据、修改套餐。',
    searchPlaceholder: '搜索名称 / slug / Owner 账号 / 邮箱 / 手机号',
    resultCount: '结果',
    empty: '当前筛选下没有匹配用户。',
    loading: '加载用户中...',
    noSelection: '请选择一个用户查看摘要。',
    sideLoading: '正在加载用户洞察...',
    sideError: '摘要加载失败',
    latestLogs: '最近业务操作',
    noLogs: '最近没有业务记录。',
    members: '成员权限',
    noMembers: '暂无成员。',
    actions: '操作',
    allTags: '自动标签',
    notes: '登录统计自接入后累计，不回填历史登录。',
    viewDetail: '打开详情',
    openMembers: '打开成员管理',
    createdAt: '注册时间',
    lastActiveAt: '最后活跃',
    ownerMissing: '无 Owner',
    listTitle: '用户列表',
    listDesc: '桌面端支持边选边看摘要；手机端点击卡片直接进入详情。',
    summaryTitle: '运营摘要',
    summaryDesc: '只读查看套餐、活跃和使用情况，写操作统一放到详情页。',
    scopes: {
      all: '全部',
      paid: '付费',
      expiring: '即将到期',
      'low-activity': '低活跃',
      'high-activity': '高活跃',
      'no-owner': '无 Owner'
    },
    metrics: {
      currentPlan: '当前套餐',
      expiresAt: '到期时间',
      lastActiveAt: '最近活跃',
      totalProducts: '产品数',
      totalImages: '图片数',
      storageUtilization: '存储利用率'
    }
  },
  en: {
    eyebrow: 'User Governance',
    title: 'Users',
    description: 'Find the tenant first, then open the detail page to inspect data and update plans.',
    searchPlaceholder: 'Search name / slug / owner account / email / phone',
    resultCount: 'Results',
    empty: 'No tenants match the current filter.',
    loading: 'Loading tenants...',
    noSelection: 'Select a tenant to inspect its summary.',
    sideLoading: 'Loading tenant insights...',
    sideError: 'Failed to load insights',
    latestLogs: 'Recent Business Activity',
    noLogs: 'No recent business activity.',
    members: 'Member Access',
    noMembers: 'No members yet.',
    actions: 'Actions',
    allTags: 'Auto Tags',
    notes: 'Login metrics accumulate from the new tracking rollout onward.',
    viewDetail: 'Open Detail',
    openMembers: 'Open Memberships',
    createdAt: 'Registered',
    lastActiveAt: 'Last Active',
    ownerMissing: 'No owner',
    listTitle: 'Tenant List',
    listDesc: 'Desktop keeps the split view; mobile opens detail directly from the card.',
    summaryTitle: 'Operator Summary',
    summaryDesc: 'Read-only overview for plan, activity, and usage. All edits move to the detail page.',
    scopes: {
      all: 'All',
      paid: 'Paid',
      expiring: 'Expiring',
      'low-activity': 'Low Activity',
      'high-activity': 'High Activity',
      'no-owner': 'No Owner'
    },
    metrics: {
      currentPlan: 'Current Plan',
      expiresAt: 'Expires At',
      lastActiveAt: 'Last Active',
      totalProducts: 'Products',
      totalImages: 'Images',
      storageUtilization: 'Storage Utilization'
    }
  }
} as const

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
  const copy = COPY[locale]

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
  }, [query])

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
        setListState({ loading: false, error: formatUnknownError(error) })
      }
    }

    void loadTenants()

    return () => {
      cancelled = true
    }
  }, [query])

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
        setSidePanelState({ loading: false, error: formatUnknownError(error) })
      }
    }

    void loadSidePanel()

    return () => {
      cancelled = true
    }
  }, [selectedTenantKey])

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
          label: copy.metrics.currentPlan,
          value: formatPlanLabel(selectedInsights.tenant.subscription?.plan ?? 'FREE')
        },
        {
          label: copy.metrics.expiresAt,
          value: formatExpiryCell(selectedInsights.tenant.subscription?.expiresAt ?? null, locale)
        },
        {
          label: copy.metrics.lastActiveAt,
          value: formatDateTimeCell(selectedInsights.tenant.lastActiveAt, locale)
        },
        { label: copy.metrics.totalProducts, value: String(selectedInsights.businessMetrics.totalProducts) },
        { label: copy.metrics.totalImages, value: String(selectedInsights.businessMetrics.totalImages) },
        {
          label: copy.metrics.storageUtilization,
          value: formatUtilization(selectedInsights.usage.usage.storageBytes.utilization)
        }
      ]
    : []

  return (
    <section className="page admin-page">
      <h2 className="visually-hidden">{copy.title}</h2>

      <AdminPanel className="stack governance-toolbar-panel">
        <form className="governance-toolbar" onSubmit={handleSearchSubmit}>
          <label className="visually-hidden" htmlFor="tenant-governance-search">
            {copy.searchPlaceholder}
          </label>
          <input
            id="tenant-governance-search"
            name="tenantSearch"
            type="search"
            autoComplete="off"
            aria-label={copy.searchPlaceholder}
            value={searchInput}
            placeholder={copy.searchPlaceholder}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit">{locale === 'zh' ? '搜索' : 'Search'}</button>
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
                {copy.scopes[item]}
              </button>
            ))}
          </div>
          <span className="muted">
            {copy.resultCount}: {filteredTenants.length}
          </span>
        </div>
      </AdminPanel>

      <div className="tenant-governance-workbench">
        <AdminPanel className="stack tenant-governance-list-panel">
          <div className="admin-section-head">
            <h3>{copy.listTitle}</h3>
            <p>{copy.listDesc}</p>
          </div>

          {listState.loading ? <p className="muted">{copy.loading}</p> : null}
          {!listState.loading && filteredTenants.length === 0 ? <p className="muted">{copy.empty}</p> : null}
          {listState.error ? <p className="error">{listState.error}</p> : null}

          <div className="tenant-governance-list">
            {filteredTenants.map((tenant) => {
              const ownerLabel = tenant.owner?.account ?? tenant.owner?.email ?? copy.ownerMissing
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
                        {formatPlanLabel(tenant.subscription?.plan ?? 'FREE')}
                      </AdminBadge>
                      <AdminBadge tone={toStatusTone(tenant.subscription?.status ?? 'ACTIVE')}>
                        {formatSubscriptionStatusLabel(tenant.subscription?.status ?? 'ACTIVE')}
                      </AdminBadge>
                    </span>
                  </span>
                  <span className="tenant-governance-meta">
                    <span className="tenant-governance-stat">
                      <span className="tenant-governance-stat-label">{copy.createdAt}</span>
                      <strong className="tenant-governance-stat-value">
                        {formatCompactDateTime(tenant.createdAt, locale)}
                      </strong>
                    </span>
                    <span className="tenant-governance-stat">
                      <span className="tenant-governance-stat-label">{copy.lastActiveAt}</span>
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
              <h3>{copy.summaryTitle}</h3>
              <p>{copy.summaryDesc}</p>
            </div>

            {!selectedTenant ? <p className="muted">{copy.noSelection}</p> : null}
            {selectedTenant && sidePanelState.loading ? <p className="muted">{copy.sideLoading}</p> : null}
            {selectedTenant && sidePanelState.error ? <p className="error">{copy.sideError}: {sidePanelState.error}</p> : null}

            {selectedTenant && selectedInsights ? (
              <>
                <div className="tenant-side-hero">
                  <div className="stack row-tight">
                    <h3>{selectedInsights.tenant.name}</h3>
                    <p className="mono">{selectedInsights.tenant.slug}</p>
                    <p className="muted">
                      {selectedInsights.tenant.owner?.account ?? selectedInsights.tenant.owner?.email ?? copy.ownerMissing}
                    </p>
                  </div>
                  <div className="inline-actions">
                    <AdminBadge tone={toPlanTone(selectedInsights.tenant.subscription?.plan ?? 'FREE')}>
                      {formatPlanLabel(selectedInsights.tenant.subscription?.plan ?? 'FREE')}
                    </AdminBadge>
                    <AdminBadge tone={toStatusTone(selectedInsights.tenant.subscription?.status ?? 'ACTIVE')}>
                      {formatSubscriptionStatusLabel(selectedInsights.tenant.subscription?.status ?? 'ACTIVE')}
                    </AdminBadge>
                  </div>
                </div>

                <div className="stack row-tight">
                  <strong>{copy.allTags}</strong>
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

                <p className="muted">{copy.notes}</p>

                <div className="stack row-tight">
                  <strong>{copy.latestLogs}</strong>
                  {selectedInsights.recentBusinessLogs.slice(0, 5).length === 0 ? <p className="muted">{copy.noLogs}</p> : null}
                  <div className="tenant-side-feed">
                    {selectedInsights.recentBusinessLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="tenant-side-feed-item">
                        <div className="stack row-tight">
                          <strong>{formatBusinessAuditActionLabel(log.action)}</strong>
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
                  <strong>{copy.members}</strong>
                  {selectedMembers.length === 0 ? <p className="muted">{copy.noMembers}</p> : null}
                  <div className="tenant-side-member-list">
                    {selectedMembers.slice(0, 5).map((member) => (
                      <div key={`${member.tenantId}:${member.user.id}`} className="tenant-side-member-item">
                        <div className="stack row-tight">
                          <strong>{member.user.email}</strong>
                          <span className="muted">{member.user.name ?? '-'}</span>
                        </div>
                        <AdminBadge tone={toRoleTone(member.role)}>{formatTenantRoleLabel(member.role)}</AdminBadge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="stack row-tight">
                  <strong>{copy.actions}</strong>
                  <div className="inline-actions">
                    <AdminActionLink href={`/dashboard/tenants/${selectedInsights.tenant.id}`}>
                      {copy.viewDetail}
                    </AdminActionLink>
                    <AdminActionLink href={`/dashboard/memberships?tenantId=${selectedInsights.tenant.id}`}>
                      {copy.openMembers}
                    </AdminActionLink>
                  </div>
                  <span className="muted">
                    {copy.createdAt}: {formatDateTime(selectedInsights.tenant.createdAt)}
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
