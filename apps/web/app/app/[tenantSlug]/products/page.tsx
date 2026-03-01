'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  createProductRequestSchema,
  createProductResponseSchema,
  listProductsResponseSchema,
  type Product
} from '@eggturtle/shared';
import { Filter, Plus, Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';

import { ApiError, apiRequest, getAccessToken, resolveAuthenticatedAssetUrl } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { NativeSelect } from '../../../../components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';

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

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

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
    type: 'breeder',
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
    type: 'breeder',
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
    type: 'breeder',
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(listQuery.search);
  const [sexFilter, setSexFilter] = useState(listQuery.sex);
  const [seriesFilter, setSeriesFilter] = useState(listQuery.seriesId);
  const [sortFilter, setSortFilter] = useState<SortSelection>(toSortSelection(listQuery.sortBy, listQuery.sortDir));
  const [coverFilter, setCoverFilter] = useState<CoverFilter>('all');
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

  function applyFilters() {
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

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters();
    setIsFilterModalOpen(false);
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
    setIsFilterModalOpen(false);
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
    const code = createCode.trim();
    if (!code) {
      setError('产品编码不能为空。');
      return;
    }

    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      const payload = createProductRequestSchema.parse({
        code
      });

      if (isDemoMode) {
        const now = new Date().toISOString();
        const demoProduct: Product = {
          id: `demo-${Date.now()}`,
          tenantId: tenantSlug,
          code: payload.code,
          type: 'breeder',
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
        setMessage(`Demo 模式：已创建产品 ${demoProduct.code}`);
        setCreateCode('');
        setIsCreateModalOpen(false);
        setSubmitting(false);
        return;
      }

      const response = await apiRequest('/products', {
        method: 'POST',
        body: payload,
        requestSchema: createProductRequestSchema,
        responseSchema: createProductResponseSchema
      });

      setMessage(`产品 ${response.product.code} 创建成功。`);
      setCreateCode('');
      setIsCreateModalOpen(false);
      await loadProducts(listQuery);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(productId: string) {
    const demoSuffix = isDemoMode ? '?demo=1' : '';
    router.push(`/app/${tenantSlug}/products/${productId}${demoSuffix}`);
  }

  function openCreateModal() {
    setError(null);
    setMessage(null);
    setIsFilterModalOpen(false);
    setCreateCode('');
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (submitting) {
      return;
    }

    setIsCreateModalOpen(false);
  }

  function renderFilterForm(scope: 'desktop' | 'mobile') {
    const searchId = `products-search-${scope}`;
    const sexId = `products-sex-filter-${scope}`;
    const seriesId = `products-series-filter-${scope}`;
    const sortId = `products-sort-${scope}`;
    const coverId = `products-cover-filter-${scope}`;

    return (
      <form className="grid gap-3" onSubmit={handleSearch}>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <div className="grid gap-1.5">
          <label htmlFor={searchId} className="text-xs font-semibold text-neutral-600">
            关键词
          </label>
          <Input
            id={searchId}
            type="text"
            placeholder="按 code / name / 描述搜索"
            value={searchInput}
            className="h-9"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={sexId} className="text-xs font-semibold text-neutral-600">
            性别
          </label>
          <NativeSelect
            id={sexId}
            value={sexFilter}
            className="h-9"
            onChange={(event) => setSexFilter(event.target.value)}
            aria-label="性别筛选"
          >
            <option value="">全部性别</option>
            <option value="male">公</option>
            <option value="female">母</option>
            <option value="unknown">未知</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={seriesId} className="text-xs font-semibold text-neutral-600">
            系列
          </label>
          <Input
            id={seriesId}
            type="text"
            placeholder="输入系列 ID"
            value={seriesFilter}
            className="h-9"
            onChange={(event) => setSeriesFilter(event.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <div className="grid gap-1.5">
          <label htmlFor={sortId} className="text-xs font-semibold text-neutral-600">
            排序
          </label>
          <NativeSelect id={sortId} value={sortFilter} className="h-9" onChange={(event) => setSortFilter(event.target.value as SortSelection)}>
            <option value="updatedAt-desc">更新时间（新到旧）</option>
            <option value="updatedAt-asc">更新时间（旧到新）</option>
            <option value="code-asc">编码（A-Z）</option>
            <option value="code-desc">编码（Z-A）</option>
          </NativeSelect>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor={coverId} className="text-xs font-semibold text-neutral-600">
            封面筛选（当前页）
          </label>
          <NativeSelect
            id={coverId}
            value={coverFilter}
            className="h-9"
            onChange={(event) => setCoverFilter(event.target.value as CoverFilter)}
            aria-label="封面筛选"
          >
            <option value="all">全部封面状态</option>
            <option value="with-cover">仅有封面</option>
            <option value="without-cover">仅无封面</option>
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          <SearchIcon size={14} />
          {loading ? '加载中...' : '应用筛选'}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={handleResetSearch} disabled={loading}>
          重置
        </Button>
      </div>
      </form>
    );
  }

  return (
    <main className="space-y-4 pb-10 sm:space-y-6">
      <Card className="tenant-card-lift hidden rounded-3xl border-neutral-200/90 bg-white transition-all lg:block">
        <CardHeader className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Filter size={16} />
              筛选工具
            </CardTitle>
            <CardDescription>
              紧凑模式，减少筛选区对产品列表的占用。
              {isDemoMode ? '（Demo 模式：仅演示 UI，不写入真实数据）' : ''}
            </CardDescription>
          </div>
          <Button type="button" size="sm" disabled={submitting} onClick={openCreateModal}>
            <Plus size={14} />
            新建产品
          </Button>
        </CardHeader>
        <CardContent className="pt-0">{renderFilterForm('desktop')}</CardContent>
      </Card>

      <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all lg:hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-xl">产品列表</CardTitle>
            <CardDescription>筛选在右下角悬浮按钮中打开。</CardDescription>
          </div>
          <Button type="button" size="sm" disabled={submitting} onClick={openCreateModal}>
            <Plus size={14} />
            新建
          </Button>
        </CardHeader>
      </Card>

      <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl">产品列表</CardTitle>
            {!loading ? (
              <CardDescription>
                共 {meta.total} 条，当前第 {meta.page}/{meta.totalPages} 页，筛选后 {filteredItems.length} 条
                {listQuery.search ? `（关键词：${listQuery.search}）` : ''}
              </CardDescription>
            ) : null}
          </div>
          <Badge variant="accent">COVER READY</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={loading || meta.page <= 1}
                onClick={() => {
                  goToPage(meta.page - 1);
                }}
              >
                上一页
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loading || meta.page >= meta.totalPages}
                onClick={() => {
                  goToPage(meta.page + 1);
                }}
              >
                下一页
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="products-page-size" className="text-sm text-neutral-600">
                每页
              </label>
              <NativeSelect
                id="products-page-size"
                value={String(listQuery.pageSize)}
                disabled={loading}
                className="w-24"
                onChange={(event) => {
                  changePageSize(Number(event.target.value));
                }}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={String(option)}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {loading ? <p className="text-sm text-neutral-600">正在加载产品列表...</p> : null}
          {!loading && filteredItems.length === 0 ? <p className="text-sm text-neutral-500">暂无产品，或当前筛选条件未命中结果。</p> : null}

          {!loading && filteredItems.length > 0 ? (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>封面</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Series</TableHead>
                      <TableHead>Sex</TableHead>
                      <TableHead>更新时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="h-14 w-14 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                            {renderCover(item)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <strong>{item.code}</strong>
                        </TableCell>
                        <TableCell>{item.seriesId || '-'}</TableCell>
                        <TableCell>{formatSex(item.sex)}</TableCell>
                        <TableCell>{formatDateTime(item.updatedAt)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              openEdit(item.id);
                            }}
                          >
                            编辑
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {filteredItems.map((item) => (
                  <article key={`${item.id}-mobile`} className="rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <div className="h-16 w-16 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">{renderCover(item)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">{item.code}</p>
                        <p className="truncate text-xs text-neutral-500">Series：{item.seriesId || '-'}</p>
                        <p className="truncate text-xs text-neutral-500">Sex：{formatSex(item.sex)}</p>
                        <p className="mt-1 text-xs text-neutral-400">{formatDateTime(item.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          openEdit(item.id);
                        }}
                      >
                        编辑
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {message ? (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-700">{message}</p>
        </Card>
      ) : null}
      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : null}

      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-5 z-40 h-12 w-12 rounded-full shadow-[0_10px_24px_rgba(0,0,0,0.22)] lg:hidden"
        aria-label="打开筛选弹窗"
        onClick={() => setIsFilterModalOpen(true)}
      >
        <SlidersHorizontal size={18} />
      </Button>

      {isFilterModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/35 p-3 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="筛选产品"
          onClick={() => setIsFilterModalOpen(false)}
        >
          <Card
            className="w-full max-h-[86vh] overflow-y-auto rounded-3xl border-neutral-200 bg-white shadow-2xl sm:max-w-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/95 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">筛选产品</CardTitle>
                  <CardDescription>设置筛选后立即回到产品列表查看结果。</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => setIsFilterModalOpen(false)}
                >
                  <X size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">{renderFilterForm('mobile')}</CardContent>
          </Card>
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="新建产品"
          onClick={closeCreateModal}
        >
          <Card className="w-full max-w-md rounded-2xl border-neutral-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-xl">新建产品</CardTitle>
              <CardDescription>请输入产品编码。名称和备注后续可在详情维护。</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateProduct}>
                <Input
                  autoFocus
                  type="text"
                  required
                  placeholder="产品编码（必填）"
                  value={createCode}
                  onChange={(event) => setCreateCode(event.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={closeCreateModal} disabled={submitting}>
                    取消
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? '创建中...' : '创建'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
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
    return <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">无封面</div>;
  }

  return <img src={resolveImageUrl(item.coverImageUrl)} alt={`${item.code} cover`} className="h-full w-full object-cover" />;
}

function resolveImageUrl(value: string) {
  return resolveAuthenticatedAssetUrl(value);
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
