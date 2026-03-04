/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  listProductsResponseSchema,
  listSeriesResponseSchema,
  type Product,
} from '@eggturtle/shared';
import { Plus, SlidersHorizontal, SquarePen } from 'lucide-react';

import { apiRequest, resolveAuthenticatedAssetUrl } from '../../../../lib/api-client';
import { formatApiError } from '../../../../lib/error-utils';
import { ensureTenantRouteSession } from '../../../../lib/tenant-route-session';
import TenantFloatingShareButton from '../../../../components/tenant-floating-share-button';
import ProductCreateDrawer, {
  type ProductSeriesOption,
} from '../../../../components/product-create-drawer';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { NativeSelect } from '../../../../components/ui/native-select';
import {
  DEFAULT_LIST_QUERY,
  PAGE_SIZE_OPTIONS,
  compareProducts,
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
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [continueEditProductId, setContinueEditProductId] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState(listQuery.search);
  const [sexFilter, setSexFilter] = useState(listQuery.sex);
  const [seriesFilterId, setSeriesFilterId] = useState(listQuery.seriesId);
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
    setSeriesFilterId(listQuery.seriesId);
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

  const buildDraftQuery = useCallback(() => {
    const [sortBy, sortDir] = parseSortSelection(sortFilter);

    return {
      ...listQuery,
      page: 1,
      search: searchInput.trim(),
      sex: sexFilter.trim(),
      seriesId: seriesFilterId.trim(),
      sortBy,
      sortDir,
    };
  }, [listQuery, searchInput, seriesFilterId, sexFilter, sortFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextQuery = buildDraftQuery();
      const hasChanged =
        nextQuery.search !== listQuery.search ||
        nextQuery.sex !== listQuery.sex ||
        nextQuery.seriesId !== listQuery.seriesId ||
        nextQuery.sortBy !== listQuery.sortBy ||
        nextQuery.sortDir !== listQuery.sortDir ||
        nextQuery.page !== listQuery.page;

      if (!hasChanged) {
        return;
      }

      setError(null);
      setMessage(null);
      setContinueEditProductId(null);
      replaceListQuery(nextQuery);
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [buildDraftQuery, listQuery, replaceListQuery]);

  function handleResetSearch() {
    setSearchInput('');
    setSexFilter('');
    setSeriesFilterId('');
    setSortFilter(toSortSelection(DEFAULT_LIST_QUERY.sortBy, DEFAULT_LIST_QUERY.sortDir));
    setCoverFilter('all');
    setError(null);
    setMessage(null);
    setContinueEditProductId(null);
    setIsFilterPopoverOpen(false);

    replaceListQuery({
      ...DEFAULT_LIST_QUERY,
      pageSize: listQuery.pageSize,
    });
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

  const quickSeriesOptions = useMemo(() => seriesOptions.slice(0, 6), [seriesOptions]);
  const hasMoreSeriesOptions = seriesOptions.length > quickSeriesOptions.length;

  const activeFilterCount =
    (searchInput.trim() ? 1 : 0) +
    (sexFilter ? 1 : 0) +
    (seriesFilterId ? 1 : 0) +
    (sortFilter !== toSortSelection(DEFAULT_LIST_QUERY.sortBy, DEFAULT_LIST_QUERY.sortDir) ? 1 : 0) +
    (coverFilter !== 'all' ? 1 : 0);

  const selectedSeriesLabel = useMemo(() => {
    if (!seriesFilterId) {
      return null;
    }

    return formatSeriesLabelById(seriesFilterId, seriesOptions);
  }, [seriesFilterId, seriesOptions]);

  function renderFilterPopover() {
    return (
      <div className="absolute right-0 top-full z-40 mt-2 w-[min(96vw,620px)] rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <p className="text-xs font-semibold text-neutral-600">关键词</p>
            <Input
              type="text"
              placeholder="按编号 / 名称 / 描述搜索"
              value={searchInput}
              className="h-9"
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <p className="text-xs font-semibold text-neutral-600">性别</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '', label: '全部' },
                { value: 'male', label: '公' },
                { value: 'female', label: '母' },
                { value: 'unknown', label: '未知' },
              ].map((item) => {
                const selected = sexFilter === item.value;
                return (
                  <button
                    key={`sex-${item.label}`}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? 'border-[#FFD400] bg-[#FFF6BF] text-neutral-900'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300'
                    }`}
                    onClick={() => setSexFilter(item.value)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-1.5">
            <p className="text-xs font-semibold text-neutral-600">系列</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  !seriesFilterId
                    ? 'border-[#FFD400] bg-[#FFF6BF] text-neutral-900'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300'
                }`}
                onClick={() => setSeriesFilterId('')}
              >
                全部
              </button>
              {quickSeriesOptions.map((item) => {
                const selected = seriesFilterId === item.id;
                return (
                  <button
                    key={`series-chip-${item.id}`}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? 'border-[#FFD400] bg-[#FFF6BF] text-neutral-900'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300'
                    }`}
                    onClick={() => setSeriesFilterId(item.id)}
                  >
                    {item.code}
                  </button>
                );
              })}
            </div>
            {hasMoreSeriesOptions ? (
              <NativeSelect
                value={seriesFilterId}
                className="h-9"
                onChange={(event) => setSeriesFilterId(event.target.value)}
              >
                <option value="">更多系列（全部）</option>
                {seriesOptions.map((item) => (
                  <option key={`series-option-${item.id}`} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <p className="text-xs font-semibold text-neutral-600">排序</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'updatedAt-desc', label: '更新时间 新→旧' },
                { value: 'updatedAt-asc', label: '更新时间 旧→新' },
                { value: 'code-asc', label: '编码 A-Z' },
                { value: 'code-desc', label: '编码 Z-A' },
              ].map((item) => {
                const selected = sortFilter === item.value;
                return (
                  <button
                    key={`sort-${item.value}`}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? 'border-[#FFD400] bg-[#FFF6BF] text-neutral-900'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300'
                    }`}
                    onClick={() => setSortFilter(item.value as SortSelection)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-1.5">
            <p className="text-xs font-semibold text-neutral-600">封面筛选（当前页）</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: '全部' },
                { value: 'with-cover', label: '仅有封面' },
                { value: 'without-cover', label: '仅无封面' },
              ].map((item) => {
                const selected = coverFilter === item.value;
                return (
                  <button
                    key={`cover-${item.value}`}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? 'border-[#FFD400] bg-[#FFF6BF] text-neutral-900'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300'
                    }`}
                    onClick={() => setCoverFilter(item.value as CoverFilter)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-2">
            <span className="text-xs text-neutral-500">点选即应用，输入关键词会在 200ms 后同步列表。</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={handleResetSearch}>
                清空
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setIsFilterPopoverOpen(false)}>
                完成
              </Button>
            </div>
          </div>
        </div>
      </div>
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
              <div className="relative">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsCreateDrawerOpen(false);
                    setIsFilterPopoverOpen((current) => !current);
                  }}
                >
                  <SlidersHorizontal size={14} />
                  筛选{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Button>
                {isFilterPopoverOpen ? renderFilterPopover() : null}
              </div>
              <Button
                type="button"
                onClick={() => {
                  setIsFilterPopoverOpen(false);
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
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5">
                  共 {meta.total} 条，当前页 {filteredItems.length} 条
                </span>
                {searchInput.trim() ? (
                  <button
                    type="button"
                    className="rounded-full border border-[#FFD400]/40 bg-[#FFF9D8] px-3 py-1.5"
                    onClick={() => setSearchInput('')}
                  >
                    关键词：{searchInput.trim()} ×
                  </button>
                ) : null}
                {sexFilter ? (
                  <button
                    type="button"
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5"
                    onClick={() => setSexFilter('')}
                  >
                    性别：{formatSex(sexFilter)} ×
                  </button>
                ) : null}
                {selectedSeriesLabel ? (
                  <button
                    type="button"
                    className="rounded-full border border-[#FFD400]/40 bg-[#FFF9D8] px-3 py-1.5"
                    onClick={() => setSeriesFilterId('')}
                  >
                    系列：{selectedSeriesLabel} ×
                  </button>
                ) : null}
                {coverFilter !== 'all' ? (
                  <button
                    type="button"
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5"
                    onClick={() => setCoverFilter('all')}
                  >
                    封面：{coverFilter === 'with-cover' ? '仅有封面' : '仅无封面'} ×
                  </button>
                ) : null}
              </div>
              <div className="relative lg:hidden">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsFilterPopoverOpen((current) => !current)}
                >
                  <SlidersHorizontal size={14} />
                  筛选{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Button>
                {isFilterPopoverOpen ? renderFilterPopover() : null}
              </div>
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

        {!isCreateDrawerOpen ? (
          <div className="mobile-fab fixed right-6 z-50 flex flex-col-reverse gap-2 lg:hidden">
            <Button
              type="button"
              size="icon"
              className="tenant-fab-button h-11 w-11"
              aria-label="新建产品"
              onClick={() => {
                setIsFilterPopoverOpen(false);
                setIsCreateDrawerOpen(true);
              }}
            >
              <Plus size={18} />
            </Button>
            <TenantFloatingShareButton intent="feed" inline className="h-11 w-11" />
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
