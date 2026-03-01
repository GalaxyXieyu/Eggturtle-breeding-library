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

type ProductDraft = {
  code: string;
  name: string;
  description: string;
};

const DEFAULT_DRAFT: ProductDraft = {
  code: '',
  name: '',
  description: ''
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

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sharingProductId, setSharingProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [coverFilter, setCoverFilter] = useState<CoverFilter>('all');
  const [draft, setDraft] = useState<ProductDraft>(DEFAULT_DRAFT);
  const [shareLinks, setShareLinks] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<ListMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });

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

  const loadProducts = useCallback(
    async (search: string) => {
      setLoading(true);

      if (isDemoMode) {
        const keyword = search.trim().toLowerCase();
        const demoItems = keyword
          ? DEMO_PRODUCTS.filter((item) => {
              const haystack = [item.code, item.name ?? '', item.description ?? '', item.seriesId ?? '', item.sex ?? '']
                .join(' ')
                .toLowerCase();
              return haystack.includes(keyword);
            })
          : DEMO_PRODUCTS;

        setItems(demoItems);
        setMeta({
          page: 1,
          pageSize: demoItems.length,
          total: demoItems.length,
          totalPages: 1
        });
        setError(null);
        setLoading(false);
        return;
      }

      const query = new URLSearchParams();
      query.set('page', '1');
      query.set('pageSize', '100');

      if (search.trim()) {
        query.set('search', search.trim());
      }

      const response = await apiRequest(`/products?${query.toString()}`, {
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
      setError('缺少 tenantSlug。');
      return;
    }

    if (isDemoMode) {
      void loadProducts('');
      return;
    }

    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
        await loadProducts('');
      } catch (requestError) {
        setError(formatError(requestError));
        setLoading(false);
      }
    })();
  }, [isDemoMode, loadProducts, router, tenantSlug]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setAppliedSearch(searchInput.trim());

    try {
      await loadProducts(searchInput.trim());
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  async function handleResetSearch() {
    setSearchInput('');
    setAppliedSearch('');
    setError(null);
    setMessage(null);

    try {
      await loadProducts('');
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
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

        setItems((currentItems) => [demoProduct, ...currentItems]);
        setMeta((currentMeta) => ({
          ...currentMeta,
          total: currentMeta.total + 1,
          pageSize: Math.max(currentMeta.pageSize, currentMeta.total + 1)
        }));
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
      await loadProducts(appliedSearch);
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
        <form className="products-filters" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="按 code / name / 描述搜索"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            value={coverFilter}
            onChange={(event) => setCoverFilter(event.target.value as CoverFilter)}
            aria-label="封面筛选"
          >
            <option value="all">全部封面状态</option>
            <option value="with-cover">仅有封面</option>
            <option value="without-cover">仅无封面</option>
          </select>
          <button type="submit" disabled={loading}>
            {loading ? '加载中...' : '应用'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              void handleResetSearch();
            }}
            disabled={loading && searchInput.length === 0}
          >
            重置
          </button>
        </form>
      </section>

      <section className="card panel stack">
        <div className="row between">
          <h2>产品列表</h2>
          {!loading ? (
            <p className="muted">
              共 {meta.total} 条，当前第 {meta.page}/{meta.totalPages} 页，筛选后 {filteredItems.length} 条
              {appliedSearch ? `（关键词：${appliedSearch}）` : ''}
            </p>
          ) : null}
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
                        {shareLinks[item.id] ? (
                          <p className="mono products-share-url">{shareLinks[item.id]}</p>
                        ) : null}
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
