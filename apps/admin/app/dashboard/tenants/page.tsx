'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listAdminTenantsResponseSchema, type AdminTenant } from '@eggturtle/shared';

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
    <section className="page">
      <header className="page-header">
        <h2>租户目录</h2>
        <p>只读查看所有租户，支持按 slug / 名称快速检索。</p>
      </header>

      <div className="grid metrics-grid">
        <article className="card stack">
          <h3>租户总数</h3>
          <p>
            <span className="badge">{tenants.length}</span>
          </p>
        </article>
        <article className="card stack">
          <h3>成员关系总数</h3>
          <p>
            <span className="badge">{totalMembers}</span>
          </p>
        </article>
      </div>

      <form className="card stack" onSubmit={handleSearchSubmit}>
        <h3>搜索</h3>
        <div className="inline-actions">
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
        </div>
      </form>

      <article className="card stack">
        <h3>租户列表</h3>
        {status.loading ? <p className="muted">加载租户中...</p> : null}
        {!status.loading && tenants.length === 0 ? (
          <p className="muted">当前筛选下未找到租户。</p>
        ) : null}
        {tenants.length > 0 ? (
          <table className="data-table">
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
                    <Link className="nav-link" href={`/dashboard/tenants/${tenant.id}`}>
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>

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
