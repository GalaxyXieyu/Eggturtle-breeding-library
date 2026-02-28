'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  listSeriesResponseSchema,
  type ListSeriesQuery,
  type Series
} from '@eggturtle/shared';

import { ApiError, apiRequest, getAccessToken } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function SeriesListPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [series, setSeries] = useState<Series[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ListMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });

  const loadSeries = useCallback(async (query: Pick<ListSeriesQuery, 'search'>) => {
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', '50');

    if (query.search) {
      params.set('search', query.search);
    }

    const path = `/series?${params.toString()}`;
    const response = await apiRequest(path, {
      responseSchema: listSeriesResponseSchema
    });

    setSeries(response.items);
    setMeta({
      page: response.page,
      pageSize: response.pageSize,
      total: response.total,
      totalPages: response.totalPages
    });
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug) {
      setError('Missing tenantSlug in route.');
      setLoading(false);
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
        await loadSeries({ search: '' });
      } catch (requestError) {
        if (!isCancelled) {
          setError(formatError(requestError));
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [loadSeries, router, tenantSlug]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await loadSeries({ search: search.trim() || undefined });
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  async function handleResetSearch() {
    setSearch('');

    try {
      await loadSeries({ search: undefined });
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-head">
        <div className="stack">
          <h1>系列管理</h1>
          <p className="muted">租户：{tenantSlug || '(unknown)'}</p>
        </div>
        <div className="row">
          <button type="button" className="secondary" onClick={() => router.push(`/app/${tenantSlug}`)}>
            返回工作台
          </button>
          <button type="button" onClick={() => router.push(`/app/${tenantSlug}/breeders`)}>
            打开种龟列表
          </button>
        </div>
      </header>

      <section className="card panel stack">
        <h2>搜索筛选</h2>
        <form className="row" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="按系列编码或名称搜索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? '加载中...' : '应用'}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={loading && search.length === 0}
            onClick={() => {
              void handleResetSearch();
            }}
          >
            重置
          </button>
        </form>
      </section>

      <section className="card panel stack">
        <div className="row between">
          <h2>系列列表</h2>
          {!loading ? (
            <p className="muted">
              共 {meta.total} 条，当前第 {meta.page}/{meta.totalPages} 页
            </p>
          ) : null}
        </div>

        {loading ? <p className="notice notice-info">正在加载系列数据...</p> : null}
        {!loading && series.length === 0 ? (
          <p className="notice notice-warning">暂无系列数据，可先录入种龟或初始化示例数据。</p>
        ) : null}

        {!loading && series.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>编码</th>
                  <th>名称</th>
                  <th>描述</th>
                  <th>排序</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {series.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.code}</strong>
                    </td>
                    <td>{item.name}</td>
                    <td>{item.description || '-'}</td>
                    <td>{item.sortOrder}</td>
                    <td>{item.isActive ? '启用' : '停用'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-compact"
                        onClick={() => router.push(`/app/${tenantSlug}/breeders?seriesId=${item.id}`)}
                      >
                        查看种龟
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {error ? <p className="notice notice-error">{error}</p> : null}
    </main>
  );
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
