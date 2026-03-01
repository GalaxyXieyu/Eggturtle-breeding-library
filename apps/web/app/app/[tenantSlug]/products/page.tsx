'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  createProductRequestSchema,
  createProductResponseSchema,
  createShareRequestSchema,
  createShareResponseSchema,
  listProductsResponseSchema,
  type Product
} from '@eggturtle/shared';

import { ApiError, apiRequest, getAccessToken, getApiBaseUrl } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type CoverFilter = 'all' | 'with-cover' | 'without-cover';

type ProductSortBy = 'updatedAt' | 'code';
type ProductSortDir = 'asc' | 'desc';
type SortSelection = `${ProductSortBy}-${ProductSortDir}`;

type ProductsListQuery = {
  page: number;
  pageSize: number;
  search: string;
  sex: string;
  seriesId: string;
  sortBy: ProductSortBy;
  sortDir: ProductSortDir;
};

type ProductDraft = {
  code: string;
  name: string;
  description: string;
};

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const DEFAULT_DRAFT: ProductDraft = {
  code: '',
  name: '',
  description: ''
};

const DEFAULT_LIST_QUERY: ProductsListQuery = {
  page: 1,
  pageSize: 20,
  search: '',
  sex: '',
  seriesId: '',
  sortBy: 'updatedAt',
  sortDir: 'desc'
};

const DEMO_PRODUCTS: Product[] = [
  {
    id: 'demo-prod-01',
    tenantId: 'demo-tenant',
    code: 'ET-MG-01',
    name: '曼谷金头 01',
    description: '展示用示例产品',
    seriesId: 'MG',
    sex: 'female',
    coverImageUrl: '/images/mg_01.jpg',
    createdAt: '2026-02-28T07:10:00.000Z',
    updatedAt: '2026-02-28T09:20:00.000Z'
  },
  {
    id: 'demo-prod-02',
    tenantId: 'demo-tenant',
    code: 'ET-MG-02',
    name: '曼谷金头 02',
    description: '展示用示例产品',
    seriesId: 'MG',
    sex: 'male',
    coverImageUrl: '/images/mg_02.jpg',
    createdAt: '2026-02-27T11:00:00.000Z',
    updatedAt: '2026-02-28T08:15:00.000Z'
  },
  {
    id: 'demo-prod-03',
    tenantId: 'demo-tenant',
    code: 'ET-MIX-03',
    name: '混系示例 03',
    description: '无封面示例',
    seriesId: null,
    sex: 'unknown',
    coverImageUrl: null,
    createdAt: '2026-02-25T03:00:00.000Z',
    updatedAt: '2026-02-26T12:45:00.000Z'
  }
];

export default function TenantProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const isDemoMode = searchParams.get('demo') === '1';

  const filterQueryKey = searchParams.toString();
  const listQuery = useMemo(() => parseListQuery(filterQueryKey), [filterQueryKey]);

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantReady, setTenantReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sharingProductId, setSharingProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(listQuery.search);
  const [sexFilter, setSexFilter] = useState(listQuery.sex);
  const [seriesFilter, setSeriesFilter] = useState(listQuery.seriesId);
  const [sortFilter, setSortFilter] = useState<SortSelection>(toSortSelection(listQuery.sortBy, listQuery.sortDir));
  const [coverFilter, setCoverFilter] = useState<CoverFilter>('all');
  const [draft, setDraft] = useState<ProductDraft>(DEFAULT_DRAFT);
  const [shareLinks, setShareLinks] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<ListMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });

  useEffect(() => {
    setSearchInput(listQuery.search);
    setSexFilter(listQuery.sex);
    setSeriesFilter(listQuery.seriesId);
    setSortFilter(toSortSelection(listQuery.sortBy, listQuery.sortDir));
  }, [listQuery]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (coverFilter === 'with-cover' && !item.coverImageUrl) {
        return false;
      }

      if (coverFilter === 'without-cover' && item.coverImageUrl) {
        return false;
      }

      return true;
    });
  }, [coverFilter, items]);

  const replaceListQuery = useCallback(
    (nextQuery: ProductsListQuery) => {
      const nextParams = new URLSearchParams();

      if (isDemoMode) {
        nextParams.set('demo', '1');
      }

      if (nextQuery.page !== DEFAULT_LIST_QUERY.page) {
        nextParams.set('page', String(nextQuery.page));
      }

      if (nextQuery.pageSize !== DEFAULT_LIST_QUERY.pageSize) {
        nextParams.set('pageSize', String(nextQuery.pageSize));
      }

      if (nextQuery.search) {
        nextParams.set('search', nextQuery.search);
      }

      if (nextQuery.sex) {
        nextParams.set('sex', nextQuery.sex);
      }

      if (nextQuery.seriesId) {
        nextParams.set('seriesId', nextQuery.seriesId);
      }

      if (nextQuery.sortBy !== DEFAULT_LIST_QUERY.sortBy || nextQuery.sortDir !== DEFAULT_LIST_QUERY.sortDir) {
        nextParams.set('sortBy', nextQuery.sortBy);
        nextParams.set('sortDir', nextQuery.sortDir);
      }

      const queryString = nextParams.toString();
      router.replace(queryString ? `/app/${tenantSlug}/products?${queryString}` : `/app/${tenantSlug}/products`);
    },
    [isDemoMode, router, tenantSlug]
  );

  const loadProducts = useCallback(
    async (query: ProductsListQuery) => {
      setLoading(true);

      if (isDemoMode) {
        const keyword = query.search.toLowerCase();

        let demoItems = DEMO_PRODUCTS.filter((item) => {
          if (!keyword) {
            return true;
          }

          const haystack = [item.code, item.name ?? '', item.description ?? '', item.seriesId ?? '', item.sex ?? '']
            .join(' ')
            .toLowerCase();
          return haystack.includes(keyword);
        });

        if (query.sex) {
          demoItems = demoItems.filter((item) => normalizeText(item.sex) === normalizeText(query.sex));
        }

        if (query.seriesId) {
          demoItems = demoItems.filter((item) => normalizeText(item.seriesId) === normalizeText(query.seriesId));
        }

        demoItems = [...demoItems].sort((left, right) => compareProducts(left, right, query.sortBy, query.sortDir));

        const total = demoItems.length;
        const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
        const page = Math.min(query.page, totalPages);
        const skip = (page - 1) * query.pageSize;

        setItems(demoItems.slice(skip, skip + query.pageSize));
        setMeta({
          page,
          pageSize: query.pageSize,
          total,
          totalPages
        });
        setError(null);
        setLoading(false);
        return;
      }

      const requestQuery = new URLSearchParams();
      requestQuery.set('page', String(query.page));
      requestQuery.set('pageSize', String(query.pageSize));

      if (query.search) {
        requestQuery.set('search', query.search);
      }

      if (query.sex) {
        requestQuery.set('sex', query.sex);
      }

      if (query.seriesId) {
        requestQuery.set('seriesId', query.seriesId);
      }

      if (query.sortBy !== DEFAULT_LIST_QUERY.sortBy || query.sortDir !== DEFAULT_LIST_QUERY.sortDir) {
        requestQuery.set('sortBy', query.sortBy);
        requestQuery.set('sortDir', query.sortDir);
      }

      const response = await apiRequest(`/products?${requestQuery.toString()}`, {
        responseSchema: listProductsResponseSchema
      });

      setItems(response.products);
      setMeta({
        page: response.page,
        pageSize: response.pageSize,
        total: response.total,
        totalPages: response.totalPages
      });
      setError(null);
      setLoading(false);
    },
    [isDemoMode]
  );

  useEffect(() => {
    if (!tenantSlug) {
      setLoading(false);
      setTenantReady(false);
      setError('缺少 tenantSlug。');
      return;
    }

    if (isDemoMode) {
      setTenantReady(true);
      return;
    }

    if (!getAccessToken()) {
      setTenantReady(false);
      router.replace('/login');
      return;
    }

    let isCancelled = false;

    setLoading(true);
    setTenantReady(false);
    setError(null);

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);

        if (!isCancelled) {
          setTenantReady(true);
        }
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
  }, [isDemoMode, router, tenantSlug]);

  useEffect(() => {
    if (!tenantReady) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        await loadProducts(listQuery);
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
  }, [listQuery, loadProducts, tenantReady]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const [sortBy, sortDir] = parseSortSelection(sortFilter);

    replaceListQuery({
      ...listQuery,
      page: 1,
      search: searchInput.trim(),
      sex: sexFilter.trim(),
      seriesId: seriesFilter.trim(),
      sortBy,
      sortDir
    });
  }

  function handleResetSearch() {
    setSearchInput('');
    setSexFilter('');
    setSeriesFilter('');
    setSortFilter(toSortSelection(DEFAULT_LIST_QUERY.sortBy, DEFAULT_LIST_QUERY.sortDir));
    setError(null);
    setMessage(null);

    replaceListQuery({
      ...DEFAULT_LIST_QUERY,
      pageSize: listQuery.pageSize
    });
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > meta.totalPages || nextPage === meta.page) {
      return;
    }

    replaceListQuery({
      ...listQuery,
      page: nextPage
    });
  }

  function changePageSize(nextPageSize: number) {
    if (nextPageSize === listQuery.pageSize) {
      return;
    }

    replaceListQuery({
      ...listQuery,
      page: 1,
      pageSize: nextPageSize
    });
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      const payload = createProductRequestSchema.parse({
        code: draft.code,
        name: draft.name.trim() ? draft.name : undefined,
        description: draft.description.trim() ? draft.description : undefined
      });

      if (isDemoMode) {
        const now = new Date().toISOString();
        const demoProduct: Product = {
          id: `demo-${Date.now()}`,
          tenantId: tenantSlug,
          code: payload.code,
          name: payload.name ?? null,
          description: payload.description ?? null,
          seriesId: null,
          sex: null,
          coverImageUrl: null,
          createdAt: now,
          updatedAt: now
        };

        setItems((currentItems) => [demoProduct, ...currentItems].slice(0, meta.pageSize));
        setMeta((currentMeta) => {
          const total = currentMeta.total + 1;
          return {
            ...currentMeta,
            total,
            totalPages: Math.max(1, Math.ceil(total / currentMeta.pageSize))
          };
        });
        setDraft(DEFAULT_DRAFT);
        setMessage(`Demo 模式：已创建产品 ${demoProduct.code}`);
        setSubmitting(false);
        return;
      }

      const response = await apiRequest('/products', {
        method: 'POST',
        body: payload,
        requestSchema: createProductRequestSchema,
        responseSchema: createProductResponseSchema
      });

      setDraft(DEFAULT_DRAFT);
      setMessage(`产品 ${response.product.code} 创建成功。`);
      await loadProducts(listQuery);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateShare(productId: string, openAfterGenerate: boolean) {
    setError(null);
    setMessage(null);
    setSharingProductId(productId);

    try {
      let entryUrl = shareLinks[productId];

      if (!entryUrl) {
        if (isDemoMode) {
          entryUrl = `${getApiBaseUrl()}/s/demo-${productId}`;
        } else {
          const payload = createShareRequestSchema.parse({
            resourceType: 'product',
            resourceId: productId
          });

          const response = await apiRequest('/shares', {
            method: 'POST',
            body: payload,
            requestSchema: createShareRequestSchema,
            responseSchema: createShareResponseSchema
          });

          entryUrl = response.share.entryUrl;
        }

        setShareLinks((currentLinks) => ({
          ...currentLinks,
          [productId]: entryUrl as string
        }));
      }

      if (entryUrl && typeof window !== 'undefined' && window.navigator?.clipboard) {
        await window.navigator.clipboard.writeText(entryUrl);
      }

      if (entryUrl && openAfterGenerate && typeof window !== 'undefined') {
        window.open(entryUrl, '_blank', 'noopener,noreferrer');
      }

      if (entryUrl) {
        setMessage(`分享链接已生成并复制：${entryUrl}`);
      }
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSharingProductId(null);
    }
  }

  function openEdit(productId: string) {
    const demoSuffix = isDemoMode ? '?demo=1' : '';
    router.push(`/app/${tenantSlug}/products/${productId}${demoSuffix}`);
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-head">
        <div className="stack">
          <h1>产品管理</h1>
          <p className="muted">租户：{tenantSlug || '(unknown)'}</p>
        </div>
        <div className="row">
          <button type="button" className="secondary" onClick={() => router.push(`/app/${tenantSlug}`)}>
            返回工作台
          </button>
        </div>
      </header>

      <section className="card panel stack">
        <div className="row between">
          <h2>新建产品</h2>
          {isDemoMode ? <p className="notice notice-info">Demo 模式：仅演示 UI，不写入真实数据。</p> : null}
        </div>
        <form className="form-grid" onSubmit={handleCreateProduct}>
          <div className="form-grid form-grid-3">
            <input
              type="text"
              required
              placeholder="产品编码（必填）"
              value={draft.code}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, code: event.target.value }))}
            />
            <input
              type="text"
              placeholder="产品名称（选填）"
              value={draft.name}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, name: event.target.value }))}
            />
            <input
              type="text"
              placeholder="备注（选填）"
              value={draft.description}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  description: event.target.value
                }))
              }
            />
          </div>
          <div className="row">
            <button type="submit" disabled={submitting}>
              {submitting ? '提交中...' : '创建产品'}
            </button>
          </div>
        </form>
      </section>

      <section className="card panel stack">
        <h2>搜索与筛选</h2>
        <form className="stack" onSubmit={handleSearch}>
          <div className="form-grid form-grid-3">
            <div className="stack">
              <label htmlFor="products-search">关键词</label>
              <input
                id="products-search"
                type="text"
                placeholder="按 code / name / 描述搜索"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>

            <div className="stack">
              <label htmlFor="products-sex-filter">性别</label>
              <select
                id="products-sex-filter"
                value={sexFilter}
                onChange={(event) => setSexFilter(event.target.value)}
                aria-label="性别筛选"
              >
                <option value="">全部性别</option>
                <option value="male">公</option>
                <option value="female">母</option>
                <option value="unknown">未知</option>
              </select>
            </div>

            <div className="stack">
              <label htmlFor="products-series-filter">系列</label>
              <input
                id="products-series-filter"
                type="text"
                placeholder="输入系列 ID"
                value={seriesFilter}
                onChange={(event) => setSeriesFilter(event.target.value)}
              />
            </div>
          </div>

          <div className="form-grid form-grid-3">
            <div className="stack">
              <label htmlFor="products-sort">排序</label>
              <select
                id="products-sort"
                value={sortFilter}
                onChange={(event) => setSortFilter(event.target.value as SortSelection)}
              >
                <option value="updatedAt-desc">更新时间（新到旧）</option>
                <option value="updatedAt-asc">更新时间（旧到新）</option>
                <option value="code-asc">编码（A-Z）</option>
                <option value="code-desc">编码（Z-A）</option>
              </select>
            </div>

            <div className="stack">
              <label htmlFor="products-cover-filter">封面筛选（当前页）</label>
              <select
                id="products-cover-filter"
                value={coverFilter}
                onChange={(event) => setCoverFilter(event.target.value as CoverFilter)}
                aria-label="封面筛选"
              >
                <option value="all">全部封面状态</option>
                <option value="with-cover">仅有封面</option>
                <option value="without-cover">仅无封面</option>
              </select>
            </div>
          </div>

          <div className="row">
            <button type="submit" disabled={loading}>
              {loading ? '加载中...' : '应用'}
            </button>
            <button type="button" className="secondary" onClick={handleResetSearch} disabled={loading}>
              重置
            </button>
          </div>
        </form>
      </section>

      <section className="card panel stack">
        <div className="row between">
          <h2>产品列表</h2>
          {!loading ? (
            <p className="muted">
              共 {meta.total} 条，当前第 {meta.page}/{meta.totalPages} 页，筛选后 {filteredItems.length} 条
              {listQuery.search ? `（关键词：${listQuery.search}）` : ''}
            </p>
          ) : null}
        </div>

        <div className="row between">
          <div className="row">
            <button
              type="button"
              className="secondary"
              disabled={loading || meta.page <= 1}
              onClick={() => {
                goToPage(meta.page - 1);
              }}
            >
              上一页
            </button>
            <button
              type="button"
              className="secondary"
              disabled={loading || meta.page >= meta.totalPages}
              onClick={() => {
                goToPage(meta.page + 1);
              }}
            >
              下一页
            </button>
          </div>

          <div className="row">
            <label htmlFor="products-page-size">每页</label>
            <select
              id="products-page-size"
              value={String(listQuery.pageSize)}
              disabled={loading}
              onChange={(event) => {
                changePageSize(Number(event.target.value));
              }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={String(option)}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? <p className="notice notice-info">正在加载产品列表...</p> : null}
        {!loading && filteredItems.length === 0 ? (
          <p className="notice notice-warning">暂无产品，或当前筛选条件未命中结果。</p>
        ) : null}

        {!loading && filteredItems.length > 0 ? (
          <>
            <div className="table-wrap products-table-desktop">
              <table className="data-table products-table">
                <thead>
                  <tr>
                    <th>封面</th>
                    <th>Code</th>
                    <th>Series</th>
                    <th>Sex</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="products-cover-cell">{renderCover(item)}</div>
                      </td>
                      <td>
                        <strong>{item.code}</strong>
                      </td>
                      <td>{item.seriesId || '-'}</td>
                      <td>{formatSex(item.sex)}</td>
                      <td>{formatDateTime(item.updatedAt)}</td>
                      <td>
                        <div className="products-actions">
                          <button
                            type="button"
                            className="btn-compact secondary"
                            onClick={() => {
                              openEdit(item.id);
                            }}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="btn-compact secondary"
                            disabled={sharingProductId === item.id}
                            onClick={() => {
                              void handleGenerateShare(item.id, false);
                            }}
                          >
                            {sharingProductId === item.id ? '生成中...' : '生成分享'}
                          </button>
                          <button
                            type="button"
                            className="btn-compact"
                            disabled={sharingProductId === item.id}
                            onClick={() => {
                              void handleGenerateShare(item.id, true);
                            }}
                          >
                            打开分享
                          </button>
                        </div>
                        {shareLinks[item.id] ? <p className="mono products-share-url">{shareLinks[item.id]}</p> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="products-mobile-list">
              {filteredItems.map((item) => (
                <article key={`${item.id}-mobile`} className="product-list-card">
                  <div className="row between">
                    <strong>{item.code}</strong>
                    <span className="muted">{formatDateTime(item.updatedAt)}</span>
                  </div>
                  <div className="row">
                    <div className="products-cover-cell products-cover-cell-mobile">{renderCover(item)}</div>
                    <div className="stack">
                      <p className="muted">Series：{item.seriesId || '-'}</p>
                      <p className="muted">Sex：{formatSex(item.sex)}</p>
                    </div>
                  </div>
                  <div className="products-actions">
                    <button
                      type="button"
                      className="btn-compact secondary"
                      onClick={() => {
                        openEdit(item.id);
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="btn-compact secondary"
                      disabled={sharingProductId === item.id}
                      onClick={() => {
                        void handleGenerateShare(item.id, false);
                      }}
                    >
                      {sharingProductId === item.id ? '生成中...' : '分享'}
                    </button>
                    <button
                      type="button"
                      className="btn-compact"
                      disabled={sharingProductId === item.id}
                      onClick={() => {
                        void handleGenerateShare(item.id, true);
                      }}
                    >
                      打开
                    </button>
                  </div>
                  {shareLinks[item.id] ? <p className="mono products-share-url">{shareLinks[item.id]}</p> : null}
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {message ? <p className="notice notice-success">{message}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
    </main>
  );
}

function parseListQuery(queryString: string): ProductsListQuery {
  const query = new URLSearchParams(queryString);
  const page = parsePositiveInt(query.get('page'), DEFAULT_LIST_QUERY.page);
  const pageSize = parsePageSize(query.get('pageSize'));

  const sortBy = query.get('sortBy') === 'code' ? 'code' : 'updatedAt';
  const sortDir = query.get('sortDir') === 'asc' ? 'asc' : 'desc';

  return {
    page,
    pageSize,
    search: (query.get('search') ?? '').trim(),
    sex: (query.get('sex') ?? '').trim(),
    seriesId: (query.get('seriesId') ?? '').trim(),
    sortBy,
    sortDir
  };
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parsePageSize(value: string | null): number {
  const parsed = Number(value);
  if (PAGE_SIZE_OPTIONS.some((option) => option === parsed)) {
    return parsed;
  }

  return DEFAULT_LIST_QUERY.pageSize;
}

function toSortSelection(sortBy: ProductSortBy, sortDir: ProductSortDir): SortSelection {
  return `${sortBy}-${sortDir}`;
}

function parseSortSelection(value: SortSelection): [ProductSortBy, ProductSortDir] {
  return value.split('-') as [ProductSortBy, ProductSortDir];
}

function compareProducts(left: Product, right: Product, sortBy: ProductSortBy, sortDir: ProductSortDir): number {
  const factor = sortDir === 'asc' ? 1 : -1;

  if (sortBy === 'code') {
    return left.code.localeCompare(right.code, 'zh-CN') * factor;
  }

  const leftValue = Date.parse(left.updatedAt ?? '');
  const rightValue = Date.parse(right.updatedAt ?? '');
  return (leftValue - rightValue) * factor;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function renderCover(item: Product) {
  if (!item.coverImageUrl) {
    return <div className="products-cover-placeholder">无封面</div>;
  }

  return <img src={resolveImageUrl(item.coverImageUrl)} alt={`${item.code} cover`} className="products-cover-thumb" />;
}

function resolveImageUrl(value: string) {
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/images/')) {
    return value;
  }

  return `${getApiBaseUrl()}${value}`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN');
}

function formatSex(value?: string | null) {
  if (!value) {
    return '-';
  }

  if (value === 'male') {
    return '公';
  }

  if (value === 'female') {
    return '母';
  }

  if (value === 'unknown') {
    return '未知';
  }

  return value;
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
