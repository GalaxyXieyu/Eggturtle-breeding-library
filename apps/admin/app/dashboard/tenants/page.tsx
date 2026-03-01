'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  listAdminTenantsResponseSchema,
  type AdminTenant
} from '@eggturtle/shared';

import {
  AdminActionLink,
  AdminMetricCard,
  AdminPageHeader,
  AdminPanel,
  AdminTableFrame
} from '../../../components/dashboard/polish-primitives';
import { useUiPreferences } from '../../../components/ui-preferences';
import { ApiError, apiRequest } from '../../../lib/api-client';

type PageState = {
  loading: boolean;
  error: string | null;
};

const COPY = {
  zh: {
    eyebrow: 'Tenant Directory',
    title: '租户目录',
    description: '统一查看平台租户，支持按名称或 slug 快速检索。',
    metricTenant: '租户总数',
    metricTenantMeta: '覆盖当前可访问的全部租户空间',
    metricMember: '成员关系总数',
    metricMemberMeta: '按当前筛选条件统计',
    searchTitle: '搜索条件',
    searchDesc: '支持租户名称与 slug 模糊检索。',
    searchPlaceholder: '按租户 slug 或名称搜索',
    apply: '应用',
    reset: '重置',
    tableTitle: '租户列表',
    tableDesc: '点击详情可进入 Subscription、配额与成员信息视图。',
    loading: '加载租户中...',
    empty: '当前筛选下未找到租户。',
    thName: '名称',
    thSlug: 'Slug',
    thMembers: '成员数',
    thCreatedAt: '创建时间',
    viewDetail: '查看详情',
    unknownError: '未知错误'
  },
  en: {
    eyebrow: 'Tenant Directory',
    title: 'Tenant Directory',
    description: 'View all tenants with quick search by name or slug.',
    metricTenant: 'Total Tenants',
    metricTenantMeta: 'All accessible tenant workspaces',
    metricMember: 'Total Memberships',
    metricMemberMeta: 'Count under current filter',
    searchTitle: 'Search Filters',
    searchDesc: 'Fuzzy search by tenant name or slug.',
    searchPlaceholder: 'Search by tenant slug or name',
    apply: 'Apply',
    reset: 'Reset',
    tableTitle: 'Tenant List',
    tableDesc: 'Open details to manage subscription, quota and members.',
    loading: 'Loading tenants...',
    empty: 'No tenants found under current filter.',
    thName: 'Name',
    thSlug: 'Slug',
    thMembers: 'Members',
    thCreatedAt: 'Created At',
    viewDetail: 'View Details',
    unknownError: 'Unknown error'
  }
} as const;

export default function DashboardTenantsPage() {
  const { locale } = useUiPreferences();
  const copy = COPY[locale];
  const [status, setStatus] = useState<PageState>({
    loading: true,
    error: null
  });
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus({ loading: true, error: null });

      try {
        const query = new URLSearchParams();
        if (appliedSearch.trim()) {
          query.set('search', appliedSearch.trim());
        }

        const response = await apiRequest(`/admin/tenants${query.size ? `?${query.toString()}` : ''}`, {
          responseSchema: listAdminTenantsResponseSchema
        });

        if (cancelled) {
          return;
        }

        setTenants(response.tenants);
        setStatus({ loading: false, error: null });
      } catch (error) {
        if (!cancelled) {
          setStatus({ loading: false, error: formatError(error, copy.unknownError) });
          setTenants([]);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [appliedSearch, copy.unknownError]);

  const totalMembers = useMemo(
    () => tenants.reduce((sum, tenant) => sum + tenant.memberCount, 0),
    [tenants]
  );

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
  }

  return (
    <section className="page admin-page">
      <AdminPageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      <div className="admin-metrics-grid">
        <AdminMetricCard
          label={copy.metricTenant}
          value={tenants.length}
          meta={copy.metricTenantMeta}
        />
        <AdminMetricCard
          label={copy.metricMember}
          value={totalMembers}
          meta={copy.metricMemberMeta}
        />
      </div>

      <AdminPanel className="stack admin-filter-panel">
        <div className="admin-section-head">
          <h3>{copy.searchTitle}</h3>
          <p>{copy.searchDesc}</p>
        </div>

        <form className="inline-actions admin-inline-form" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            value={searchInput}
            placeholder={copy.searchPlaceholder}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit">{copy.apply}</button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setSearchInput('');
              setAppliedSearch('');
            }}
          >
            {copy.reset}
          </button>
        </form>
      </AdminPanel>

      <AdminPanel className="stack">
        <div className="admin-section-head">
          <h3>{copy.tableTitle}</h3>
          <p>{copy.tableDesc}</p>
        </div>

        {status.loading ? <p className="muted">{copy.loading}</p> : null}
        {!status.loading && tenants.length === 0 ? (
          <p className="muted">{copy.empty}</p>
        ) : null}

        {tenants.length > 0 ? (
          <AdminTableFrame>
            <thead>
              <tr>
                <th>{copy.thName}</th>
                <th>{copy.thSlug}</th>
                <th>{copy.thMembers}</th>
                <th>{copy.thCreatedAt}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>{tenant.name}</td>
                  <td className="mono">{tenant.slug}</td>
                  <td>{tenant.memberCount}</td>
                  <td>{formatDate(tenant.createdAt)}</td>
                  <td>
                    <AdminActionLink href={`/dashboard/tenants/${tenant.id}`}>{copy.viewDetail}</AdminActionLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTableFrame>
        ) : null}
      </AdminPanel>

      {status.error ? <p className="error">{status.error}</p> : null}
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
