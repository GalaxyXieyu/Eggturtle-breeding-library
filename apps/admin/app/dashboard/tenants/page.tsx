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
import { ApiError, apiRequest } from '../../../lib/api-client';

type PageState = {
  loading: boolean;
  error: string | null;
};

export default function DashboardTenantsPage() {
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
          setStatus({ loading: false, error: formatError(error) });
          setTenants([]);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [appliedSearch]);

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
        eyebrow="Tenant Directory"
        title="租户目录"
        description="统一查看平台租户，支持按名称或 slug 快速检索。"
      />

      <div className="admin-metrics-grid">
        <AdminMetricCard
          label="租户总数"
          value={tenants.length}
          meta="覆盖当前可访问的全部租户空间"
        />
        <AdminMetricCard
          label="成员关系总数"
          value={totalMembers}
          meta="按当前筛选条件统计"
        />
      </div>

      <AdminPanel className="stack admin-filter-panel">
        <div className="admin-section-head">
          <h3>搜索条件</h3>
          <p>支持租户名称与 slug 模糊检索。</p>
        </div>

        <form className="inline-actions admin-inline-form" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            value={searchInput}
            placeholder="按租户 slug 或名称搜索"
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit">应用</button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setSearchInput('');
              setAppliedSearch('');
            }}
          >
            重置
          </button>
        </form>
      </AdminPanel>

      <AdminPanel className="stack">
        <div className="admin-section-head">
          <h3>租户列表</h3>
          <p>点击详情可进入 Subscription、配额与成员信息视图。</p>
        </div>

        {status.loading ? <p className="muted">加载租户中...</p> : null}
        {!status.loading && tenants.length === 0 ? (
          <p className="muted">当前筛选下未找到租户。</p>
        ) : null}

        {tenants.length > 0 ? (
          <AdminTableFrame>
            <thead>
              <tr>
                <th>名称</th>
                <th>Slug</th>
                <th>成员数</th>
                <th>创建时间</th>
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
                    <AdminActionLink href={`/dashboard/tenants/${tenant.id}`}>查看详情</AdminActionLink>
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

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
}
