/* eslint-disable @next/next/no-img-element */
'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  listProductsResponseSchema,
  listSeriesResponseSchema,
  type Product,
} from '@eggturtle/shared';
import { Plus, Search as SearchIcon, SlidersHorizontal, SquarePen, X } from 'lucide-react';

import { apiRequest, resolveAuthenticatedAssetUrl } from '../../../../lib/api-client';
import { formatApiError } from '../../../../lib/error-utils';
import { ensureTenantRouteSession } from '../../../../lib/tenant-route-session';
import TenantFloatingShareButton from '../../../../components/tenant-floating-share-button';
import ProductCreateDrawer, {
  type ProductSeriesOption,
} from '../../../../components/product-create-drawer';
import { Button } from '../../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { NativeSelect } from '../../../../components/ui/native-select';
import {
  DEFAULT_LIST_QUERY,
  PAGE_SIZE_OPTIONS,
  compareProducts,
  findSeriesByInput,
  formatSeriesLabelById,
  parseListQuery,
  parseSortSelection,
  toSortSelection,
  type ProductsListQuery,
  type SortSelection,
} from './products-page-utils';

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type CoverFilter = 'all' | 'with-cover' | 'without-cover';

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
    needMatingStatus: 'need_mating',
    lastEggAt: '2026-02-19T00:00:00.000Z',
    lastMatingAt: '2026-01-29T00:00:00.000Z',
    daysSinceEgg: 12,
    offspringUnitPrice: 20000,
    coverImageUrl: '/images/mg_01.jpg',
    createdAt: '2026-02-28T07:10:00.000Z',
    updatedAt: '2026-02-28T09:20:00.000Z',
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
    needMatingStatus: 'normal',
    coverImageUrl: '/images/mg_02.jpg',
    createdAt: '2026-02-27T11:00:00.000Z',
    updatedAt: '2026-02-28T08:15:00.000Z',
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
    updatedAt: '2026-02-26T12:45:00.000Z',
  },
];

const MODAL_CLOSE_BUTTON_CLASS =
  '!h-10 !w-10 !min-h-10 !min-w-10 !rounded-full !border-0 !p-0 !leading-none bg-neutral-900 text-white shadow-[0_10px_24px_rgba(0,0,0,0.34)] ring-1 ring-black/20 transition hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-black/35 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200';

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
  const [seriesOptions, setSeriesOptions] = useState<ProductSeriesOption[]>([]);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [continueEditProductId, setContinueEditProductId] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState(listQuery.search);
  const [sexFilter, setSexFilter] = useState(listQuery.sex);
  const [seriesInput, setSeriesInput] = useState(listQuery.seriesId);
  const [sortFilter, setSortFilter] = useState<SortSelection>(
    toSortSelection(listQuery.sortBy, listQuery.sortDir),
  );
  const [coverFilter, setCoverFilter] = useState<CoverFilter>('all');

  const [meta, setMeta] = useState<ListMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    setSearchInput(listQuery.search);
    setSexFilter(listQuery.sex);
    setSeriesInput(listQuery.seriesId);
    setSortFilter(toSortSelection(listQuery.sortBy, listQuery.sortDir));
  }, [listQuery]);

  useEffect(() => {
    if (searchParams.get('view') !== 'manage') {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('view');
    const nextQuery = nextParams.toString();
    router.replace(
      nextQuery ? `/app/${tenantSlug}/products?${nextQuery}` : `/app/${tenantSlug}/products`,
    );
  }, [router, searchParams, tenantSlug]);

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

      if (
        nextQuery.sortBy !== DEFAULT_LIST_QUERY.sortBy ||
        nextQuery.sortDir !== DEFAULT_LIST_QUERY.sortDir
      ) {
        nextParams.set('sortBy', nextQuery.sortBy);
        nextParams.set('sortDir', nextQuery.sortDir);
      }

      const queryString = nextParams.toString();
      router.replace(
        queryString ? `/app/${tenantSlug}/products?${queryString}` : `/app/${tenantSlug}/products`,
      );
    },
    [isDemoMode, router, tenantSlug],
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

          return [item.code, item.name ?? '', item.description ?? '', item.seriesId ?? '']
            .join(' ')
            .toLowerCase()
            .includes(keyword);
        });

        if (query.sex) {
          demoItems = demoItems.filter(
            (item) => normalizeText(item.sex) === normalizeText(query.sex),
          );
        }

        if (query.seriesId) {
          demoItems = demoItems.filter(
            (item) => normalizeText(item.seriesId) === normalizeText(query.seriesId),
          );
        }

        demoItems = [...demoItems].sort((left, right) =>
          compareProducts(left, right, query.sortBy, query.sortDir),
        );

        const total = demoItems.length;
        const start = (query.page - 1) * query.pageSize;
        const pagedItems = demoItems.slice(start, start + query.pageSize);

        setItems(pagedItems);
        setMeta({
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
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
      requestQuery.set('sortBy', query.sortBy);
      requestQuery.set('sortDir', query.sortDir);

      const path = `/products?${requestQuery.toString()}`;
      const response = await apiRequest(path, {
        responseSchema: listProductsResponseSchema,
      });

      setItems(response.products);
      setMeta({
        page: response.page,
        pageSize: response.pageSize,
        total: response.total,
        totalPages: response.totalPages,
      });
      setError(null);
      setLoading(false);
    },
    [isDemoMode],
  );

  const loadSeriesOptions = useCallback(async () => {
    if (isDemoMode) {
      const seen = new Set<string>();
      const demoSeries: ProductSeriesOption[] = [];

      DEMO_PRODUCTS.forEach((item) => {
        const seriesId = item.seriesId?.trim();
        if (!seriesId || seen.has(seriesId)) {
          return;
        }
        seen.add(seriesId);
        demoSeries.push({
          id: seriesId,
          code: seriesId,
          name: seriesId,
        });
      });

      setSeriesOptions(demoSeries);
      return;
    }

    const response = await apiRequest('/series?page=1&pageSize=100', {
      responseSchema: listSeriesResponseSchema,
    });

    setSeriesOptions(
      response.items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
      })),
    );
  }, [isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      setTenantReady(true);
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        const access = await ensureTenantRouteSession({
          tenantSlug,
          missingTenantMessage: '缺少 tenantSlug。',
          router,
        });

        if (!access.ok) {
          if (!isCancelled && access.reason === 'missing-tenant') {
            setError(access.message ?? '缺少 tenantSlug。');
            setLoading(false);
          }
          return;
        }

        if (!isCancelled) {
          setTenantReady(true);
        }
      } catch (requestError) {
        if (!isCancelled) {
          setError(formatApiError(requestError));
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
        await Promise.all([loadProducts(listQuery), loadSeriesOptions()]);
      } catch (requestError) {
        if (!isCancelled) {
          setError(formatApiError(requestError));
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [listQuery, loadProducts, loadSeriesOptions, tenantReady]);

  function applyFilters() {
    setError(null);
    setMessage(null);
    setContinueEditProductId(null);

    const [sortBy, sortDir] = parseSortSelection(sortFilter);
    const trimmedSeriesInput = seriesInput.trim();
    const matchedSeries = findSeriesByInput(trimmedSeriesInput, seriesOptions);

    if (trimmedSeriesInput && !matchedSeries) {
      setError('未匹配到系列，请输入已存在的系列名称/编码/ID，或先用新建功能创建系列。');
      return;
    }

    replaceListQuery({
      ...listQuery,
      page: 1,
      search: searchInput.trim(),
      sex: sexFilter.trim(),
      seriesId: matchedSeries ? matchedSeries.id : '',
      sortBy,
      sortDir,
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
    setSeriesInput('');
    setSortFilter(toSortSelection(DEFAULT_LIST_QUERY.sortBy, DEFAULT_LIST_QUERY.sortDir));
    setError(null);
    setMessage(null);
    setContinueEditProductId(null);

    replaceListQuery({
      ...DEFAULT_LIST_QUERY,
      pageSize: listQuery.pageSize,
    });
    setIsFilterModalOpen(false);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > meta.totalPages || nextPage === meta.page) {
      return;
    }

    replaceListQuery({
      ...listQuery,
      page: nextPage,
    });
  }

  function changePageSize(nextPageSize: number) {
    if (nextPageSize === listQuery.pageSize) {
      return;
    }

    replaceListQuery({
      ...listQuery,
      page: 1,
      pageSize: nextPageSize,
    });
  }

  function openEdit(productId: string) {
    const demoSuffix = isDemoMode ? '?demo=1' : '';
    router.push(`/app/${tenantSlug}/products/${productId}${demoSuffix}`);
  }

  function openPreviewDetail(productId: string) {
    const query = new URLSearchParams();
    query.set('from', 'products');

    if (isDemoMode) {
      query.set('demo', '1');
    }

    const queryString = query.toString();
    router.push(
      queryString
        ? `/app/${tenantSlug}/breeders/${productId}?${queryString}`
        : `/app/${tenantSlug}/breeders/${productId}`,
    );
  }

  function handleSeriesCreated(series: ProductSeriesOption) {
    setSeriesOptions((current) => {
      if (current.some((item) => item.id === series.id)) {
        return current;
      }

      const next = [...current, series];
      next.sort((left, right) => left.code.localeCompare(right.code, 'zh-CN'));
      return next;
    });
  }

  async function handleCreated(result: {
    product: Product;
    imageFailures: number;
    message: string;
  }) {
    setError(null);
    setMessage(result.message);
    setContinueEditProductId(result.imageFailures > 0 ? result.product.id : null);

    if (isDemoMode) {
      setItems((currentItems) => [result.product, ...currentItems].slice(0, meta.pageSize));
      setMeta((currentMeta) => {
        const total = currentMeta.total + 1;
        return {
          ...currentMeta,
          total,
          totalPages: Math.max(1, Math.ceil(total / currentMeta.pageSize)),
        };
      });
      return;
    }

    await loadProducts(listQuery);
  }

  function renderFilterForm(scope: 'desktop' | 'mobile') {
    const searchId = `products-search-${scope}`;
    const sexId = `products-sex-filter-${scope}`;
    const seriesId = `products-series-filter-${scope}`;
    const seriesOptionsId = `products-series-options-${scope}`;
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
              placeholder="按编号 / 名称 / 描述搜索"
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
              系列（输入自动识别）
            </label>
            <Input
              id={seriesId}
              type="text"
              list={seriesOptionsId}
              placeholder="输入系列编码 / 名称 / ID"
              value={seriesInput}
              className="h-9"
              onChange={(event) => setSeriesInput(event.target.value)}
            />
            <datalist id={seriesOptionsId}>
              {seriesOptions.flatMap((item) => [
                <option key={`${scope}-${item.id}-code`} value={item.code}>
                  {item.name}
                </option>,
                <option key={`${scope}-${item.id}-name`} value={item.name}>
                  {item.code}
                </option>,
                <option key={`${scope}-${item.id}-id`} value={item.id}>
                  {item.name}
                </option>,
              ])}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <label htmlFor={sortId} className="text-xs font-semibold text-neutral-600">
              排序
            </label>
            <NativeSelect
              id={sortId}
              value={sortFilter}
              className="h-9"
              onChange={(event) => setSortFilter(event.target.value as SortSelection)}
            >
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
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleResetSearch}
            disabled={loading}
          >
            重置
          </Button>
        </div>
      </form>
    );
  }

  return (
    <>
      <main className="space-y-4 pb-10 sm:space-y-6">
        <Card className="rounded-3xl border-neutral-200/90 bg-white/92 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">宠物</p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-900">宠物视图</h2>
              <p className="mt-1 text-xs text-neutral-600">
                瀑布流预览 + 抽屉创建流程（先图片，后资料）。
                {isDemoMode ? '（演示模式：仅演示界面，不写入真实数据）' : ''}
              </p>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsCreateDrawerOpen(false);
                  setIsFilterModalOpen(true);
                }}
              >
                <SlidersHorizontal size={14} />
                筛选
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsFilterModalOpen(false);
                  setIsCreateDrawerOpen(true);
                }}
              >
                <Plus size={14} />
                新建产品
              </Button>
            </div>
          </div>
        </Card>

        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5">
                共 {meta.total} 条，当前页 {filteredItems.length} 条
              </span>
              {listQuery.seriesId ? (
                <span className="rounded-full border border-[#FFD400]/40 bg-[#FFF9D8] px-3 py-1.5">
                  系列：{formatSeriesLabelById(listQuery.seriesId, seriesOptions)}
                </span>
              ) : null}
              {listQuery.sex ? (
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5">
                  性别：{formatSex(listQuery.sex)}
                </span>
              ) : null}
            </div>

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

            {loading ? <p className="text-sm text-neutral-600">正在加载宠物预览...</p> : null}
            {!loading && filteredItems.length === 0 ? (
              <p className="text-sm text-neutral-500">暂无产品，或当前筛选条件未命中结果。</p>
            ) : null}

            {!loading && filteredItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4 xl:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                {filteredItems.map((item) => (
                  <article
                    key={`preview-${item.id}`}
                    className="group cursor-pointer overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_12px_34px_rgba(0,0,0,0.14)]"
                    role="button"
                    tabIndex={0}
                    aria-label={`查看 ${item.code} 详情`}
                    onClick={() => openPreviewDetail(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openPreviewDetail(item.id);
                      }
                    }}
                  >
                    <div className="relative aspect-[4/5] bg-neutral-100">
                      {item.coverImageUrl ? (
                        <img
                          src={resolveImageUrl(item.coverImageUrl)}
                          alt={`${item.code} 封面`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                          暂无封面
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
                      {item.needMatingStatus === 'need_mating' || item.needMatingStatus === 'warning' ? (
                        <div
                          className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.needMatingStatus === 'need_mating'
                              ? 'bg-[#FFD400]/90 text-black ring-1 ring-black/10'
                              : 'bg-red-600/90 text-white ring-1 ring-black/10'
                          }`}
                        >
                          {item.needMatingStatus === 'need_mating' ? '待配' : '⚠️逾期未交配'}
                          {typeof item.daysSinceEgg === 'number' ? ` 第${item.daysSinceEgg}天` : ''}
                        </div>
                      ) : null}
                      <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-xs text-black">
                        {formatSex(item.sex)}
                      </div>
                      <span className="absolute bottom-2 right-2 flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.12)] transition-transform duration-200 hover:scale-105">
                        <button
                          type="button"
                          data-ui="button"
                          className="h-full w-full flex items-center justify-center rounded-full border border-white/70 bg-white/90 p-0 text-neutral-700 backdrop-blur-sm transition-all duration-200 hover:border-[#FFD400]/80 hover:bg-[#FFD400] hover:text-white hover:shadow-[0_4px_16px_rgba(255,212,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:border-white/40 dark:bg-neutral-800/90 dark:text-neutral-200 dark:hover:bg-[#FFD400] dark:hover:text-white [&_svg]:shrink-0"
                          aria-label={`编辑 ${item.code}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(item.id);
                          }}
                        >
                          <SquarePen size={14} strokeWidth={2.25} />
                        </button>
                      </span>
                    </div>

                    <div className="p-3 lg:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-sm font-semibold tracking-wide text-neutral-900 sm:text-base lg:text-lg">
                          {item.code}
                        </div>
                        {typeof item.offspringUnitPrice === 'number' ? (
                          <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold leading-5 text-[#FFD400] ring-1 ring-white/10 sm:text-xs">
                            子代 ¥ {item.offspringUnitPrice}
                          </span>
                        ) : null}
                      </div>

                      {item.lastEggAt || item.lastMatingAt ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-neutral-700">
                          {item.lastEggAt ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 ring-1 ring-amber-200/60">
                              产蛋 {formatShortDate(item.lastEggAt)}
                            </span>
                          ) : null}
                          {item.lastMatingAt ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 ring-1 ring-emerald-200/60">
                              交配 {formatShortDate(item.lastMatingAt)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {item.description ? (
                        <div className="mt-2 rounded-xl bg-neutral-100/80 px-2.5 py-1.5 text-xs leading-relaxed text-neutral-700 sm:text-sm">
                          <span className="line-clamp-2">{item.description}</span>
                        </div>
                      ) : null}

                      {item.sireCode || item.damCode ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-neutral-700">
                          {item.sireCode ? (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                              父系 {item.sireCode}
                            </span>
                          ) : null}
                          {item.damCode ? (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                              母系 {item.damCode}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {message ? (
          <Card className="rounded-2xl border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-700">{message}</p>
            {continueEditProductId ? (
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => openEdit(continueEditProductId)}
                >
                  继续编辑图片
                </Button>
              </div>
            ) : null}
          </Card>
        ) : null}
        {error ? (
          <Card className="rounded-2xl border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </Card>
        ) : null}

        {!isFilterModalOpen && !isCreateDrawerOpen ? (
          <div className="mobile-fab fixed right-6 z-50 flex flex-col-reverse gap-2 lg:hidden">
            <Button
              type="button"
              size="icon"
              className="tenant-fab-button h-11 w-11"
              aria-label="新建产品"
              onClick={() => {
                setIsFilterModalOpen(false);
                setIsCreateDrawerOpen(true);
              }}
            >
              <Plus size={18} />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="tenant-fab-button bg-white/95 dark:bg-neutral-900/92"
              aria-label="打开筛选弹窗"
              onClick={() => {
                setIsCreateDrawerOpen(false);
                setIsFilterModalOpen(true);
              }}
            >
              <SlidersHorizontal size={18} />
            </Button>
            <TenantFloatingShareButton intent="feed" inline className="h-11 w-11" />
          </div>
        ) : null}

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
                    className={MODAL_CLOSE_BUTTON_CLASS}
                    onClick={() => setIsFilterModalOpen(false)}
                    aria-label="关闭筛选"
                  >
                    <X size={17} strokeWidth={2.6} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">{renderFilterForm('mobile')}</CardContent>
            </Card>
          </div>
        ) : null}
      </main>

      <ProductCreateDrawer
        open={isCreateDrawerOpen}
        onClose={() => setIsCreateDrawerOpen(false)}
        tenantSlug={tenantSlug}
        isDemoMode={isDemoMode}
        seriesOptions={seriesOptions}
        onSeriesCreated={handleSeriesCreated}
        onCreated={handleCreated}
      />
    </>
  );
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function resolveImageUrl(value: string) {
  return resolveAuthenticatedAssetUrl(value);
}

function formatSex(value?: string | null) {
  if (!value) {
    return '未知';
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

function formatShortDate(value?: string | null) {
  const raw = (value ?? '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return '';
  }

  return `${match[2]}.${match[3]}`;
}
