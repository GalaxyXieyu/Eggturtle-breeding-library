/* eslint-disable @next/next/no-img-element */
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  listProductsResponseSchema,
  listSeriesResponseSchema,
  type Product,
} from '@eggturtle/shared';
import { Plus, SlidersHorizontal, SquarePen, X } from 'lucide-react';

import { apiRequest, resolveAuthenticatedAssetUrl } from '../../../../lib/api-client';
import { formatApiError } from '../../../../lib/error-utils';
import { formatSex } from '../../../../lib/pet-format';
import { ensureTenantRouteSession } from '../../../../lib/tenant-route-session';
import { buildFilterPillClass } from '../../../../components/filter-pill';
import { PetCard } from '../../../../components/pet';
import ProductDrawer, {
  type ProductSeriesOption,
} from '../../../../components/product-drawer';
import TenantFloatingShareButton from '../../../../components/tenant-floating-share-button';
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
  type ProductsListQuery,
} from './products-page-utils';

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const SEX_FILTER_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'female', label: '母' },
  { value: 'male', label: '公' },
  { value: 'unknown', label: '未知' },
] as const;

const FILTER_SHEET_CLOSE_BUTTON_CLASS =
  'inline-flex !h-10 !w-10 !min-h-10 !min-w-10 !shrink-0 !items-center !justify-center !rounded-full !border-0 !p-0 !leading-none bg-neutral-900 text-white shadow-[0_10px_24px_rgba(0,0,0,0.34)] ring-1 ring-black/20 transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200';

function resolveTenantScrollRoot(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  return document.querySelector<HTMLElement>('[data-tenant-scroll-root="true"]');
}

function readScrollTop(target: HTMLElement | Window) {
  if (target instanceof Window) {
    return target.scrollY;
  }

  return target.scrollTop;
}

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
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [showMobileFilterFab, setShowMobileFilterFab] = useState(false);
  const [isMobileFilterLayout, setIsMobileFilterLayout] = useState(false);
  const mobileTopFilterRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [continueEditProductId, setContinueEditProductId] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState(listQuery.search);
  const [sexFilter, setSexFilter] = useState(listQuery.sex);
  const [seriesFilterId, setSeriesFilterId] = useState(listQuery.seriesId);
  const editingProduct = useMemo(
    () => items.find((item) => item.id === editingProductId) ?? null,
    [editingProductId, items],
  );

  useEffect(() => {
    if (!isFilterPopoverOpen) {
      return;
    }

    const scrollTarget = resolveTenantScrollRoot() ?? window;

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-products-filter-root="true"]')) {
        return;
      }
      setIsFilterPopoverOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterPopoverOpen(false);
      }
    };

    const handleScroll = () => {
      setIsFilterPopoverOpen(false);
    };

    const clickOptions: AddEventListenerOptions = { capture: true };

    document.addEventListener('click', handleClickAway, clickOptions);
    document.addEventListener('keydown', handleKeyDown);
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      document.removeEventListener('click', handleClickAway, clickOptions);
      document.removeEventListener('keydown', handleKeyDown);
      scrollTarget.removeEventListener('scroll', handleScroll);
    };
  }, [isFilterPopoverOpen]);

  useEffect(() => {
    let rafId: number | null = null;
    const syncTimerIds: number[] = [];
    const scrollTarget = resolveTenantScrollRoot() ?? window;

    const update = () => {
      rafId = null;

      const topFilter = mobileTopFilterRef.current;
      const scrollY = readScrollTop(scrollTarget);

      setShowMobileFilterFab((current) => {
        if (current) {
          // When FAB is visible, show top filter again only after user scrolls back up.
          return scrollY > 140;
        }

        if (!topFilter) {
          return scrollY > 220;
        }

        const bottom = topFilter.getBoundingClientRect().bottom;
        return bottom < 8;
      });
    };

    const scheduleUpdate = () => {
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(update);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleUpdate();
      }
    };

    // 滚动容器在路由切换后可能异步恢复 scrollTop，这里补几次重算避免首屏状态错位。
    scheduleUpdate();
    syncTimerIds.push(window.setTimeout(scheduleUpdate, 120));
    syncTimerIds.push(window.setTimeout(scheduleUpdate, 320));

    scrollTarget.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    window.addEventListener('focus', scheduleUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      scrollTarget.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', scheduleUpdate);
      window.removeEventListener('pageshow', scheduleUpdate);
      window.removeEventListener('focus', scheduleUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      syncTimerIds.forEach((timerId) => window.clearTimeout(timerId));
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => {
      setIsMobileFilterLayout(media.matches);
    };

    update();
    media.addEventListener('change', update);
    window.addEventListener('resize', update);

    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

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
    return {
      ...listQuery,
      page: 1,
      search: searchInput.trim(),
      sex: sexFilter.trim(),
      seriesId: seriesFilterId.trim(),
      sortBy: 'code' as const,
      sortDir: 'asc' as const,
    };
  }, [listQuery, searchInput, seriesFilterId, sexFilter]);

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
    setEditingProductId(productId);
    setIsEditDrawerOpen(true);
    setError(null);
    setMessage(null);
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

  const quickSeriesOptions = useMemo(() => {
    const base = seriesOptions.slice(0, 6);

    if (!seriesFilterId) {
      return base;
    }

    const selectedOption = seriesOptions.find((item) => item.id === seriesFilterId);
    if (!selectedOption) {
      return base;
    }

    if (base.some((item) => item.id === selectedOption.id)) {
      return base;
    }

    return [selectedOption, ...base.slice(0, 5)];
  }, [seriesFilterId, seriesOptions]);
  const hasMoreSeriesOptions = seriesOptions.length > quickSeriesOptions.length;

  const activeFilterCount =
    (searchInput.trim() ? 1 : 0) + (sexFilter ? 1 : 0) + (seriesFilterId ? 1 : 0);

  const selectedSeriesLabel = useMemo(() => {
    if (!seriesFilterId) {
      return null;
    }

    return formatSeriesLabelById(seriesFilterId, seriesOptions);
  }, [seriesFilterId, seriesOptions]);

  function renderSexPills(keyPrefix: string, className?: string) {
    return SEX_FILTER_OPTIONS.map((item) => {
      const selected = sexFilter === item.value;
      return (
        <button
          key={`${keyPrefix}-${item.label}`}
          type="button"
          className={buildFilterPillClass(selected, { className })}
          onClick={() => setSexFilter(item.value)}
        >
          {item.label}
        </button>
      );
    });
  }

  function renderSeriesPills(
    keyPrefix: string,
    options?: {
      className?: string;
      showMoreButton?: boolean;
      onMoreClick?: (event: ReactMouseEvent<HTMLElement>) => void;
    },
  ) {
    const className = options?.className;
    return (
      <>
        <button
          type="button"
          className={buildFilterPillClass(!seriesFilterId, { className })}
          onClick={() => setSeriesFilterId('')}
        >
          全部
        </button>
        {quickSeriesOptions.map((item) => {
          const selected = seriesFilterId === item.id;
          return (
            <button
              key={`${keyPrefix}-${item.id}`}
              type="button"
              title={`${item.code}${item.name ? ` · ${item.name}` : ''}`}
              className={buildFilterPillClass(selected, { className })}
              onClick={() => setSeriesFilterId(item.id)}
            >
              <span className="max-w-[9.5rem] truncate">{item.code}</span>
            </button>
          );
        })}
        {options?.showMoreButton && hasMoreSeriesOptions ? (
          <button
            type="button"
            className={buildFilterPillClass(false, { className: `${className ?? ''} font-medium`.trim() })}
            onClick={(event) => options.onMoreClick?.(event)}
          >
            更多…
          </button>
        ) : null}
      </>
    );
  }


  const filterPopoverAnchorRef = useRef<HTMLElement | null>(null);
  const [filterPopoverAnchorRect, setFilterPopoverAnchorRect] = useState<DOMRect | null>(null);
  const [filterPopoverPlacement, setFilterPopoverPlacement] = useState<'above' | 'below'>('below');

  const openFilterPopover = (
    event: ReactMouseEvent<HTMLElement>,
    placement: 'above' | 'below',
    options?: { toggle?: boolean },
  ) => {
    const shouldToggle = options?.toggle ?? false;
    if (isMobileFilterLayout && showMobileFilterFab) {
      setIsFilterPopoverOpen((current) => (shouldToggle ? !current : true));
      return;
    }

    filterPopoverAnchorRef.current = event.currentTarget;
    setFilterPopoverAnchorRect(event.currentTarget.getBoundingClientRect());
    setFilterPopoverPlacement(placement);

    setIsFilterPopoverOpen((current) => (shouldToggle ? !current : true));
  };

  useEffect(() => {
    if (!isFilterPopoverOpen || (isMobileFilterLayout && showMobileFilterFab)) {
      return;
    }

    const anchor = filterPopoverAnchorRef.current;
    if (!anchor) {
      return;
    }

    const update = () => {
      setFilterPopoverAnchorRect(anchor.getBoundingClientRect());
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [isFilterPopoverOpen, isMobileFilterLayout, showMobileFilterFab]);

  function renderFilterPanelBody() {
    return (
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
          <p className="text-xs font-medium text-neutral-600">性别</p>
          <div className="flex flex-wrap gap-2">{renderSexPills('sex-panel')}</div>
        </div>

        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-neutral-600">系列</p>
          <div className="flex flex-wrap gap-2">{renderSeriesPills('series-panel')}</div>
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
    );
  }

  function renderMobileFilterSheet() {
    return (
      <div
        className="fixed inset-0 z-[70] flex items-end bg-black/35 p-3 sm:items-center sm:justify-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="筛选宠物"
        onClick={() => setIsFilterPopoverOpen(false)}
      >
        <div
          className="w-full max-h-[86vh] overflow-y-auto rounded-3xl border border-neutral-200 bg-white p-4 shadow-2xl sm:max-w-xl dark:border-white/10 dark:bg-neutral-900"
          data-products-filter-root="true"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">筛选宠物</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">选择条件后会实时更新列表。</p>
            </div>
            <button
              type="button"
              className={FILTER_SHEET_CLOSE_BUTTON_CLASS}
              aria-label="关闭筛选"
              onClick={() => setIsFilterPopoverOpen(false)}
            >
              <X size={17} strokeWidth={2.6} />
            </button>
          </div>
          {renderFilterPanelBody()}
        </div>
      </div>
    );
  }

  function renderFilterPopover(placement: 'above' | 'below' = 'below') {
    const placementClass =
      'fixed left-1/2 z-40 w-[min(96vw,620px)] -translate-x-1/2 max-h-[min(80vh,560px)] overflow-y-auto overscroll-contain rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur';

    const placementStyle: CSSProperties | undefined =
      typeof window === 'undefined'
        ? undefined
        : placement === 'above'
          ? {
              top: 'calc(env(safe-area-inset-top) + 10px)',
            }
          : {
              top: filterPopoverAnchorRect ? Math.round(filterPopoverAnchorRect.bottom + 8) : 96,
            };

    return (
      <div className={placementClass} style={placementStyle} data-products-filter-root="true" role="dialog">
        {renderFilterPanelBody()}
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
              <div className="relative" data-products-filter-root="true">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(event) => {
                    setIsCreateDrawerOpen(false);
                    openFilterPopover(event, 'below', { toggle: true });
                  }}
                >
                  <SlidersHorizontal size={14} />
                  筛选{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Button>
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
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5">
                共 {meta.total} 条，当前页 {items.length} 条
              </span>
            </div>


            {!showMobileFilterFab ? (
              <div
                ref={mobileTopFilterRef}
                className="z-20 border border-black/5 bg-white/95 px-3 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 lg:hidden lg:rounded-2xl"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-neutral-600">筛选</p>
                  <div className="relative" data-products-filter-root="true">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={(event) => openFilterPopover(event, 'below', { toggle: true })}
                    >
                      <SlidersHorizontal size={14} />
                      筛选{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <p className="mt-2 w-10 shrink-0 text-[11px] font-medium text-neutral-500">系列</p>
                    <div className="flex min-w-0 max-w-full flex-1 gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {renderSeriesPills('series-top', {
                        className: 'shrink-0',
                        showMoreButton: true,
                        onMoreClick: (event) => openFilterPopover(event, 'below'),
                      })}
                    </div>
                  </div>

                  <div className="flex min-w-0 items-start gap-2">
                    <p className="mt-2 w-10 shrink-0 text-[11px] font-medium text-neutral-500">性别</p>
                    <div className="flex min-w-0 max-w-full flex-1 gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {renderSexPills('sex-top', 'shrink-0')}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeFilterCount > 0 ? (
              <div className="hidden flex-wrap gap-2 text-xs text-neutral-600 lg:flex">
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
              </div>
            ) : null}

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
            {!loading && items.length === 0 ? (
              <p className="text-sm text-neutral-500">暂无产品，或当前筛选条件未命中结果。</p>
            ) : null}

            {!loading && items.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4 xl:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                {items.map((item) => (
                  <PetCard
                    key={`preview-${item.id}`}
                    variant="tenant"
                    code={item.code}
                    coverImageUrl={item.coverImageUrl ? resolveAuthenticatedAssetUrl(item.coverImageUrl) : null}
                    coverFallbackImageUrl={null}
                    coverAlt={`${item.code} 封面`}
                    sex={item.sex}
                    needMatingStatus={item.needMatingStatus}
                    daysSinceEgg={item.daysSinceEgg}
                    offspringUnitPrice={item.offspringUnitPrice}
                    lastEggAt={item.lastEggAt}
                    lastMatingAt={item.lastMatingAt}
                    description={item.description}
                    sireCode={item.sireCode}
                    damCode={item.damCode}
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
                    topRightSlot={
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.12)] transition-transform duration-200 hover:scale-105">
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
                    }
                  />
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
                  继续抽屉编辑
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
            {showMobileFilterFab ? (
              <div className="relative" data-products-filter-root="true">
                <Button
                  type="button"
                  size="icon"
                  variant="default"
                  className="h-11 w-11 rounded-full border border-black/10 bg-neutral-900 text-white shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur transition hover:scale-[1.05] hover:bg-neutral-800 [&_svg]:text-white"
                  aria-label="打开筛选"
                  onClick={(event) => openFilterPopover(event, 'above', { toggle: true })}
                >
                  <SlidersHorizontal size={18} />
                </Button>
                {activeFilterCount > 0 ? (
                  <span className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FFD400] px-1 text-[11px] font-semibold text-neutral-900 shadow-[0_10px_18px_rgba(0,0,0,0.18)] ring-1 ring-black/10">
                    {activeFilterCount}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </main>

      {isFilterPopoverOpen
        ? isMobileFilterLayout && showMobileFilterFab
          ? renderMobileFilterSheet()
          : renderFilterPopover(filterPopoverPlacement)
        : null}

      <ProductDrawer
        mode="edit"
        open={isEditDrawerOpen}
        product={editingProduct}
        tenantSlug={tenantSlug}
        isDemoMode={isDemoMode}
        seriesOptions={seriesOptions}
        onSeriesCreated={handleSeriesCreated}
        onClose={() => {
          setIsEditDrawerOpen(false);
          setEditingProductId(null);
        }}
        onSaved={(nextProduct) => {
          setItems((currentItems) =>
            currentItems.map((item) => (item.id === nextProduct.id ? nextProduct : item)),
          );
          setMessage(`已保存 ${nextProduct.code}。`);
          setError(null);
          setContinueEditProductId(null);
        }}
      />

      <ProductDrawer
        mode="create"
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
