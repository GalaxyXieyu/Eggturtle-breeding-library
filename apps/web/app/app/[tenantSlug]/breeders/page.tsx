'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  listBreedersResponseSchema,
  listSeriesResponseSchema,
  type Breeder,
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

type Filters = {
  code: string;
  search: string;
  seriesId: string;
};

export default function BreedersListPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const searchParams = useSearchParams();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const filterQueryKey = searchParams.toString();
  const initialFilters = useMemo<Filters>(() => {
    const query = new URLSearchParams(filterQueryKey);

    return {
      seriesId: query.get('seriesId') ?? '',
      search: query.get('search') ?? '',
      code: query.get('code') ?? ''
    };
  }, [filterQueryKey]);

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [seriesOptions, setSeriesOptions] = useState<Series[]>([]);
  const [items, setItems] = useState<Breeder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ListMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });

  const loadSeriesOptions = useCallback(async () => {
    const response = await apiRequest('/series?page=1&pageSize=100', {
      responseSchema: listSeriesResponseSchema
    });

    setSeriesOptions(response.items);
  }, []);

  const loadBreeders = useCallback(async (query: Filters) => {
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', '50');

    if (query.seriesId) {
      params.set('seriesId', query.seriesId);
    }

    if (query.search) {
      params.set('search', query.search);
    }

    if (query.code) {
      params.set('code', query.code);
    }

    const response = await apiRequest(`/breeders?${params.toString()}`, {
      responseSchema: listBreedersResponseSchema
    });

    setItems(response.items);
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
    setFilters(initialFilters);
  }, [initialFilters]);

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
        await Promise.all([loadSeriesOptions(), loadBreeders(initialFilters)]);
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
  }, [initialFilters, loadBreeders, loadSeriesOptions, router, tenantSlug]);

  async function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const query: Filters = {
        seriesId: filters.seriesId,
        search: filters.search.trim(),
        code: filters.code.trim()
      };

      const nextUrl = new URLSearchParams();
      if (query.seriesId) {
        nextUrl.set('seriesId', query.seriesId);
      }
      if (query.search) {
        nextUrl.set('search', query.search);
      }
      if (query.code) {
        nextUrl.set('code', query.code);
      }

      const suffix = nextUrl.toString();
      router.replace(suffix ? `/app/${tenantSlug}/breeders?${suffix}` : `/app/${tenantSlug}/breeders`);

      await loadBreeders(query);
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  async function handleResetFilters() {
    const resetValue = {
      seriesId: '',
      search: '',
      code: ''
    };

    setFilters(resetValue);
    router.replace(`/app/${tenantSlug}/breeders`);

    try {
      await loadBreeders(resetValue);
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-head">
        <div className="stack">
          <h1>种龟管理</h1>
          <p className="muted">租户：{tenantSlug || '(unknown)'}</p>
        </div>
        <div className="row">
          <button type="button" className="secondary" onClick={() => router.push(`/app/${tenantSlug}`)}>
            返回工作台
          </button>
          <button type="button" onClick={() => router.push(`/app/${tenantSlug}/series`)}>
            打开系列管理
          </button>
        </div>
      </header>

      <section className="card panel stack">
        <h2>筛选条件</h2>
        <form className="stack" onSubmit={handleApplyFilters}>
          <div className="form-grid form-grid-3">
            <div className="stack">
              <label htmlFor="series-filter">系列</label>
              <select
                id="series-filter"
                value={filters.seriesId}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, seriesId: event.target.value }));
                }}
              >
                <option value="">全部系列</option>
                {seriesOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.code} / {option.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="stack">
              <label htmlFor="search-filter">关键字搜索</label>
              <input
                id="search-filter"
                type="text"
                placeholder="按编码或名称搜索"
                value={filters.search}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, search: event.target.value }));
                }}
              />
            </div>

            <div className="stack">
              <label htmlFor="code-filter">精准编码</label>
              <input
                id="code-filter"
                type="text"
                placeholder="BRD-ALPHA-001"
                value={filters.code}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, code: event.target.value }));
                }}
              />
            </div>
          </div>

          <div className="row">
            <button type="submit" disabled={loading}>
              {loading ? '加载中...' : '应用筛选'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={loading && !filters.seriesId && !filters.search && !filters.code}
              onClick={() => {
                void handleResetFilters();
              }}
            >
              重置
            </button>
          </div>
        </form>
      </section>

      <section className="card panel stack">
        <div className="row between">
          <h2>种龟列表</h2>
          {!loading ? (
            <p className="muted">
              共 {meta.total} 条，当前第 {meta.page}/{meta.totalPages} 页
            </p>
          ) : null}
        </div>

        {loading ? <p className="notice notice-info">正在加载种龟数据...</p> : null}
        {!loading && items.length === 0 ? <p className="notice notice-warning">当前筛选条件下没有结果。</p> : null}

        {!loading && items.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>编码</th>
                  <th>名称</th>
                  <th>系列</th>
                  <th>性别</th>
                  <th>状态</th>
                  <th>描述</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.code}</strong>
                    </td>
                    <td>{item.name ?? '未命名'}</td>
                    <td>{item.series?.code ?? '未关联'}</td>
                    <td>{item.sex ?? '未知'}</td>
                    <td>{item.isActive ? '启用' : '停用'}</td>
                    <td>{item.description ?? '-'}</td>
                    <td>
                      <div className="row">
                        <button type="button" className="btn-compact" onClick={() => router.push(`/app/${tenantSlug}/breeders/${item.id}`)}>
                          详情
                        </button>
                        <button
                          type="button"
                          className="btn-compact secondary"
                          onClick={() =>
                            router.push(
                              `/app/${tenantSlug}/series?search=${encodeURIComponent(item.series?.code ?? '')}`
                            )
                          }
                        >
                          关联系列
                        </button>
                      </div>
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
