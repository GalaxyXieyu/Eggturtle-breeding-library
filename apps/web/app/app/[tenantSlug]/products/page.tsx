/* eslint-disable @next/next/no-img-element */
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  getTenantSharePresentationResponseSchema,
  listProductsResponseSchema,
  listSeriesResponseSchema,
  type Product,
  type ProductListStats,
} from '@eggturtle/shared';
import { Plus, Search } from 'lucide-react';

import { apiRequest, resolveAuthenticatedAssetUrl } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import { ensureTenantRouteSession } from '@/lib/tenant-route-session';
import ProductDrawer, {
  type ProductSeriesOption,
} from '@/components/product-drawer';
import TenantFloatingShareButton from '@/components/tenant-floating-share-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FloatingActionButton,
  FloatingActionDock,
} from '@/components/ui/floating-actions';
import {
  DEFAULT_LIST_QUERY,
  compareProducts,
  formatSeriesLabelById,
  parseListQuery,
  type ProductsListQuery,
} from '@/app/app/[tenantSlug]/products/products-page-utils';
import ProductsFilterOverlay from '@/app/app/[tenantSlug]/products/products-filter-overlay';
import ProductsListCard from '@/app/app/[tenantSlug]/products/products-list-card';
import {
  DEFAULT_SHARE_PREVIEW_HERO,
  DEMO_PRODUCTS,
  EMPTY_LIST_STATS,
  LIST_PAGE_SIZE,
  STATUS_FILTER_OPTIONS,
  type ListMeta,
  type ProductsPagePayload,
  type SharePreviewState,
} from '@/app/app/[tenantSlug]/products/products-page-state';
import ProductsSharePreviewCard from '@/app/app/[tenantSlug]/products/products-share-preview-card';
import {
  appendUniqueProducts,
  buildStatsFromProducts,
  normalizeText,
} from '@/app/app/[tenantSlug]/products/products-page-data-utils';
import {
  buildDemoSharePreview,
  buildFallbackSharePreview,
  buildSharePreviewFromPresentation,
  hexToRgba,
} from '@/app/app/[tenantSlug]/products/products-share-preview-utils';
import { useProductsPageUiEffects } from '@/app/app/[tenantSlug]/products/products-page-ui-hooks';

const DASHBOARD_WINDOW_LABELS: Partial<Record<string, string>> = {
  today: '今日',
  '7d': '近 7 天',
  '30d': '近 30 天',
};

const DASHBOARD_METRIC_LABELS: Partial<Record<string, string>> = {
  eggs_total: '产蛋总数',
  eggs_events: '产蛋事件',
  mating_events: '配对事件',
  need_mating: '需配对',
  warnings: '预警',
  share_uv: '分享 UV',
  share_pv: '页面访问',
};

// State persistence for products page
const PRODUCTS_PAGE_STATE_KEY_PREFIX = 'products-page-state:v1:';
const PRODUCTS_PAGE_STATE_TTL_MS = 30 * 60 * 1000; // 30 minutes

type ProductsPagePersistedState = {
  savedAt: number;
  searchInput: string;
  sexFilter: string;
  seriesFilterId: string;
  statusFilter: string;
  items: Product[];
  nextPage: number;
  hasMore: boolean;
  scrollY: number;
};

function buildProductsStateKey(tenantSlug: string, filterQuery: string): string {
  return `${PRODUCTS_PAGE_STATE_KEY_PREFIX}${tenantSlug}:${filterQuery}`;
}

function parseProductsPersistedState(raw: string | null): ProductsPagePersistedState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProductsPagePersistedState>;

    if (
      typeof parsed.savedAt !== 'number' ||
      typeof parsed.searchInput !== 'string' ||
      typeof parsed.sexFilter !== 'string' ||
      typeof parsed.seriesFilterId !== 'string' ||
      typeof parsed.statusFilter !== 'string' ||
      !Array.isArray(parsed.items) ||
      typeof parsed.nextPage !== 'number' ||
      typeof parsed.hasMore !== 'boolean' ||
      typeof parsed.scrollY !== 'number'
    ) {
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      searchInput: parsed.searchInput,
      sexFilter: parsed.sexFilter,
      seriesFilterId: parsed.seriesFilterId,
      statusFilter: parsed.statusFilter,
      items: parsed.items,
      nextPage: parsed.nextPage,
      hasMore: parsed.hasMore,
      scrollY: parsed.scrollY,
    };
  } catch {
    return null;
  }
}

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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextPage, setNextPage] = useState(1);
  const [listStats, setListStats] = useState<ProductListStats>(EMPTY_LIST_STATS);
  const queryVersionRef = useRef(0);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const [tenantReady, setTenantReady] = useState(false);
  const [seriesOptions, setSeriesOptions] = useState<ProductSeriesOption[]>([]);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [showMobileFilterFab, setShowMobileFilterFab] = useState(false);
  const [isMobileFilterLayout, setIsMobileFilterLayout] = useState(false);
  const mobileTopFilterRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [continueEditProductId, setContinueEditProductId] = useState<string | null>(null);
  const [sharePreview, setSharePreview] = useState<SharePreviewState>(() =>
    buildFallbackSharePreview(''),
  );
  const [shareHeroIndex, setShareHeroIndex] = useState(0);

  const [searchInput, setSearchInput] = useState(listQuery.search);
  const [sexFilter, setSexFilter] = useState(listQuery.sex);
  const [seriesFilterId, setSeriesFilterId] = useState(listQuery.seriesId);
  const [statusFilter, setStatusFilter] = useState(listQuery.status);
  const [hasHydratedState, setHasHydratedState] = useState(false);
  const stateStorageKey = useMemo(
    () => buildProductsStateKey(tenantSlug, filterQueryKey),
    [tenantSlug, filterQueryKey]
  );
  const editingProduct = useMemo(
    () => items.find((item) => item.id === editingProductId) ?? null,
    [editingProductId, items],
  );
  const shareHeroSignature = useMemo(() => sharePreview.heroImages.join('|'), [sharePreview.heroImages]);
  const shareHeroImageUrl = resolveAuthenticatedAssetUrl(
    sharePreview.heroImages[shareHeroIndex] ??
      sharePreview.heroImages[0] ??
      DEFAULT_SHARE_PREVIEW_HERO,
  );
  const sharePosterImageUrls = useMemo(() => {
    // First, try to get images from different series in the product list
    const seriesImageMap = new Map<string, string>();

    for (const product of items) {
      if (!product.coverImageUrl) continue;

      const seriesId = product.seriesId || 'no-series';
      if (!seriesImageMap.has(seriesId)) {
        seriesImageMap.set(seriesId, product.coverImageUrl);
      }
    }

    // Collect images from different series
    const diverseImages = Array.from(seriesImageMap.values());

    // If we have enough diverse images from products, use them
    if (diverseImages.length >= 5) {
      return diverseImages
        .slice(0, 10)
        .map((item) => resolveAuthenticatedAssetUrl(item));
    }

    // Otherwise, fall back to configured hero images
    return sharePreview.heroImages
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => resolveAuthenticatedAssetUrl(item));
  }, [items, sharePreview.heroImages]);
  const shareOverlayColor = hexToRgba(sharePreview.brandSecondary, 0.4);

  useEffect(() => {
    setSharePreview(buildFallbackSharePreview(tenantSlug));
  }, [tenantSlug]);

  useEffect(() => {
    setShareHeroIndex(0);
  }, [shareHeroSignature]);

  useEffect(() => {
    if (sharePreview.heroImages.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setShareHeroIndex((current) => (current + 1) % sharePreview.heroImages.length);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [sharePreview.heroImages]);

  useProductsPageUiEffects({
    isFilterPopoverOpen,
    setIsFilterPopoverOpen,
    mobileTopFilterRef,
    setShowMobileFilterFab,
    setIsMobileFilterLayout,
  });

  const [meta, setMeta] = useState<ListMeta>({
    page: 1,
    pageSize: LIST_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const persistProductsState = useCallback(
    (scrollY: number) => {
      if (typeof window === 'undefined') {
        return;
      }

      const snapshot: ProductsPagePersistedState = {
        savedAt: Date.now(),
        searchInput,
        sexFilter,
        seriesFilterId,
        statusFilter,
        items,
        nextPage,
        hasMore,
        scrollY: Math.max(0, Math.floor(scrollY)),
      };

      try {
        window.sessionStorage.setItem(stateStorageKey, JSON.stringify(snapshot));
      } catch {
        // Ignore storage quota and private mode write errors.
      }
    },
    [searchInput, sexFilter, seriesFilterId, statusFilter, items, nextPage, hasMore, stateStorageKey]
  );

  useEffect(() => {
    setSearchInput(listQuery.search);
    setSexFilter(listQuery.sex);
    setSeriesFilterId(listQuery.seriesId);
    setStatusFilter(listQuery.status);
  }, [listQuery]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    let hasChanged = false;

    if (nextParams.get('view') === 'manage') {
      nextParams.delete('view');
      hasChanged = true;
    }
    if (nextParams.has('page')) {
      nextParams.delete('page');
      hasChanged = true;
    }
    if (nextParams.has('pageSize')) {
      nextParams.delete('pageSize');
      hasChanged = true;
    }

    if (!hasChanged) {
      return;
    }
    const nextQuery = nextParams.toString();
    router.replace(
      nextQuery ? `/app/${tenantSlug}/products?${nextQuery}` : `/app/${tenantSlug}/products`,
    );
  }, [router, searchParams, tenantSlug]);


  const replaceListQuery = useCallback(
    (nextQuery: ProductsListQuery) => {
      const nextParams = new URLSearchParams();
      const source = searchParams.get('from');
      const sourceWindow = searchParams.get('window');
      const sourceMetric = searchParams.get('metric');

      if (isDemoMode) {
        nextParams.set('demo', '1');
      }

      if (source === 'dashboard') {
        nextParams.set('from', source);
        if (sourceWindow) {
          nextParams.set('window', sourceWindow);
        }
        if (sourceMetric) {
          nextParams.set('metric', sourceMetric);
        }
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

      if (nextQuery.status) {
        nextParams.set('status', nextQuery.status);
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
    [isDemoMode, router, searchParams, tenantSlug],
  );

  const loadProductsPage = useCallback(
    async (query: ProductsListQuery, page: number): Promise<ProductsPagePayload> => {
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
        const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
        const start = (page - 1) * LIST_PAGE_SIZE;
        const pageItems = demoItems.slice(start, start + LIST_PAGE_SIZE);

        return {
          products: pageItems,
          total,
          page,
          pageSize: LIST_PAGE_SIZE,
          totalPages,
          stats: buildStatsFromProducts(demoItems),
        };
      }

      const requestQuery = new URLSearchParams();
      requestQuery.set('page', String(page));
      requestQuery.set('pageSize', String(LIST_PAGE_SIZE));

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
      return apiRequest(path, {
        responseSchema: listProductsResponseSchema,
      });
    },
    [isDemoMode],
  );

  const loadProducts = useCallback(
    async (query: ProductsListQuery) => {
      const requestVersion = queryVersionRef.current + 1;
      queryVersionRef.current = requestVersion;

      setLoading(true);
      setIsLoadingMore(false);
      setHasMore(false);
      setNextPage(1);
      setItems([]);
      setListStats(EMPTY_LIST_STATS);

      const response = await loadProductsPage(query, 1);
      if (queryVersionRef.current !== requestVersion) {
        return;
      }

      setItems(response.products);
      setMeta({
        page: response.page,
        pageSize: response.pageSize,
        total: response.total,
        totalPages: response.totalPages,
      });
      setListStats(response.stats);
      setHasMore(response.page < response.totalPages);
      setNextPage(response.page + 1);
      setError(null);
      setLoading(false);
    },
    [loadProductsPage],
  );

  const loadMoreProducts = useCallback(async () => {
    if (loading || isLoadingMore || !hasMore) {
      return;
    }

    const requestVersion = queryVersionRef.current;
    const page = nextPage;
    setIsLoadingMore(true);

    try {
      const response = await loadProductsPage(listQuery, page);
      if (queryVersionRef.current !== requestVersion) {
        return;
      }

      setItems((currentItems) => appendUniqueProducts(currentItems, response.products));
      setMeta({
        page: response.page,
        pageSize: response.pageSize,
        total: response.total,
        totalPages: response.totalPages,
      });
      setListStats(response.stats);
      setHasMore(response.page < response.totalPages);
      setNextPage(response.page + 1);
      setError(null);
    } catch (requestError) {
      if (queryVersionRef.current === requestVersion) {
        setError(formatApiError(requestError));
      }
    } finally {
      if (queryVersionRef.current === requestVersion) {
        setIsLoadingMore(false);
      }
    }
  }, [hasMore, isLoadingMore, listQuery, loadProductsPage, loading, nextPage]);

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

  const loadSharePreview = useCallback(async () => {
    if (isDemoMode) {
      setSharePreview(buildDemoSharePreview(tenantSlug));
      return;
    }

    try {
      const response = await apiRequest('/tenant-share-presentation', {
        responseSchema: getTenantSharePresentationResponseSchema,
      });
      setSharePreview(buildSharePreviewFromPresentation(response.presentation, tenantSlug));
    } catch {
      setSharePreview(buildFallbackSharePreview(tenantSlug));
    }
  }, [isDemoMode, tenantSlug]);

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

  // Restore persisted state on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !tenantReady) {
      return;
    }

    const parsed = parseProductsPersistedState(window.sessionStorage.getItem(stateStorageKey));
    if (!parsed || Date.now() - parsed.savedAt > PRODUCTS_PAGE_STATE_TTL_MS) {
      setHasHydratedState(true);
      return;
    }

    // Restore filter states
    setSearchInput(parsed.searchInput);
    setSexFilter(parsed.sexFilter);
    setSeriesFilterId(parsed.seriesFilterId);
    setStatusFilter(parsed.statusFilter);

    // Restore loaded items and pagination
    setItems(parsed.items);
    setNextPage(parsed.nextPage);
    setHasMore(parsed.hasMore);
    setListStats(buildStatsFromProducts(parsed.items));
    setLoading(false);

    // Restore scroll position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollRoot = document.querySelector('[data-tenant-scroll-root="true"]');
        if (scrollRoot) {
          scrollRoot.scrollTop = parsed.scrollY;
        } else {
          window.scrollTo(0, parsed.scrollY);
        }
      });
    });

    setHasHydratedState(true);
  }, [stateStorageKey, tenantReady]);

  useEffect(() => {
    if (!tenantReady || !hasHydratedState) {
      return;
    }

    // Skip loading if we just restored from persisted state
    const parsed = parseProductsPersistedState(window.sessionStorage.getItem(stateStorageKey));
    if (parsed && Date.now() - parsed.savedAt <= PRODUCTS_PAGE_STATE_TTL_MS && items.length > 0) {
      // State was restored, just load series options and share preview
      void (async () => {
        try {
          await Promise.all([loadSeriesOptions(), loadSharePreview()]);
        } catch (requestError) {
          setError(formatApiError(requestError));
        }
      })();
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        await Promise.all([loadProducts(listQuery), loadSeriesOptions(), loadSharePreview()]);
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
  }, [listQuery, loadProducts, loadSeriesOptions, loadSharePreview, tenantReady, hasHydratedState, stateStorageKey, items.length]);

  useEffect(() => {
    if (!tenantReady || loading || isLoadingMore || !hasMore) {
      return;
    }

    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) {
      return;
    }

    const scrollRoot =
      typeof document === 'undefined'
        ? null
        : document.querySelector<HTMLElement>('[data-tenant-scroll-root="true"]');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreProducts();
        }
      },
      {
        root: scrollRoot ?? null,
        rootMargin: '320px 0px 320px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, items.length, loadMoreProducts, loading, tenantReady]);

  // Persist state on scroll
  useEffect(() => {
    if (!hasHydratedState) {
      return;
    }

    let rafId: number | null = null;
    const scrollTarget =
      typeof document !== 'undefined'
        ? document.querySelector<HTMLElement>('[data-tenant-scroll-root="true"]') ?? window
        : null;

    if (!scrollTarget) {
      return;
    }

    const handleScroll = () => {
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const scrollY = scrollTarget instanceof Window ? scrollTarget.scrollY : scrollTarget.scrollTop;
        persistProductsState(scrollY);
      });
    };

    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollTarget.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [hasHydratedState, persistProductsState]);

  // Persist state when filters or items change
  useEffect(() => {
    if (!hasHydratedState) {
      return;
    }

    const scrollTarget =
      typeof document !== 'undefined'
        ? document.querySelector<HTMLElement>('[data-tenant-scroll-root="true"]') ?? window
        : null;

    if (!scrollTarget) {
      return;
    }

    const scrollY = scrollTarget instanceof Window ? scrollTarget.scrollY : scrollTarget.scrollTop;
    persistProductsState(scrollY);
  }, [searchInput, sexFilter, seriesFilterId, statusFilter, items, nextPage, hasMore, hasHydratedState, persistProductsState]);

  const buildDraftQuery = useCallback(() => {
    return {
      ...listQuery,
      page: 1,
      pageSize: LIST_PAGE_SIZE,
      search: searchInput.trim(),
      sex: sexFilter.trim(),
      seriesId: seriesFilterId.trim(),
      status: statusFilter.trim(),
      sortBy: 'code' as const,
      sortDir: 'asc' as const,
    };
  }, [listQuery, searchInput, seriesFilterId, sexFilter, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextQuery = buildDraftQuery();
      const hasChanged =
        nextQuery.search !== listQuery.search ||
        nextQuery.sex !== listQuery.sex ||
        nextQuery.seriesId !== listQuery.seriesId ||
        nextQuery.status !== listQuery.status ||
        nextQuery.sortBy !== listQuery.sortBy ||
        nextQuery.sortDir !== listQuery.sortDir;

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
    setStatusFilter('');
    setError(null);
    setMessage(null);
    setContinueEditProductId(null);
    setIsFilterPopoverOpen(false);

    replaceListQuery({
      ...DEFAULT_LIST_QUERY,
      pageSize: LIST_PAGE_SIZE,
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
      setItems((currentItems) => appendUniqueProducts([result.product], currentItems));
      setMeta((currentMeta) => {
        const total = currentMeta.total + 1;
        const totalPages = Math.max(1, Math.ceil(total / currentMeta.pageSize));
        return {
          ...currentMeta,
          total,
          totalPages,
        };
      });
      setListStats((currentStats) => {
        const normalizedSex = normalizeText(result.product.sex);
        return {
          ...currentStats,
          maleCount: currentStats.maleCount + (normalizedSex === 'male' ? 1 : 0),
          femaleCount: currentStats.femaleCount + (normalizedSex === 'female' ? 1 : 0),
          unknownCount:
            currentStats.unknownCount + (normalizedSex === 'male' || normalizedSex === 'female' ? 0 : 1),
          needMatingCount:
            currentStats.needMatingCount + (result.product.needMatingStatus === 'need_mating' ? 1 : 0),
          warningCount: currentStats.warningCount + (result.product.needMatingStatus === 'warning' ? 1 : 0),
        };
      });
      return;
    }

    await loadProducts(listQuery);
  }

  const quickSeriesOptions = useMemo(() => {
    return seriesOptions;
  }, [seriesOptions]);
  const hasMoreSeriesOptions = seriesOptions.length > quickSeriesOptions.length;

  const activeFilterCount =
    (searchInput.trim() ? 1 : 0) +
    (sexFilter ? 1 : 0) +
    (seriesFilterId ? 1 : 0) +
    (statusFilter ? 1 : 0);

  const selectedSeriesLabel = useMemo(() => {
    if (!seriesFilterId) {
      return null;
    }

    return formatSeriesLabelById(seriesFilterId, seriesOptions);
  }, [seriesFilterId, seriesOptions]);
  const listStatsLabel = useMemo(() => {
    const base = `${listStats.maleCount}公${listStats.femaleCount}母 今年已产${listStats.yearEggCount}蛋 ${listStats.needMatingCount}只待交配`;
    if (listStats.warningCount > 0) {
      return `${base} ⚠️${listStats.warningCount}只超时未交配`;
    }
    return base;
  }, [listStats.femaleCount, listStats.maleCount, listStats.needMatingCount, listStats.warningCount, listStats.yearEggCount]);
  const selectedStatusLabel = useMemo(() => {
    if (!statusFilter) {
      return null;
    }

    return STATUS_FILTER_OPTIONS.find((item) => item.value === statusFilter)?.label ?? statusFilter;
  }, [statusFilter]);
  const dashboardDrilldownTags = useMemo(() => {
    if (searchParams.get('from') !== 'dashboard') {
      return [];
    }

    const tags: string[] = [];
    const windowLabel = DASHBOARD_WINDOW_LABELS[searchParams.get('window') ?? ''];
    const metricLabel = DASHBOARD_METRIC_LABELS[searchParams.get('metric') ?? ''];

    if (windowLabel) {
      tags.push(windowLabel);
    }
    if (metricLabel) {
      tags.push(metricLabel);
    }

    if (sexFilter) {
      if (sexFilter === 'female') {
        tags.push('母龟');
      } else if (sexFilter === 'male') {
        tags.push('公龟');
      } else if (sexFilter === 'unknown') {
        tags.push('性别未知');
      } else {
        tags.push(`性别 ${sexFilter}`);
      }
    }

    if (selectedStatusLabel) {
      tags.push(selectedStatusLabel);
    }
    if (selectedSeriesLabel) {
      tags.push(`系列 ${selectedSeriesLabel}`);
    }
    if (searchInput.trim()) {
      tags.push(`关键词“${searchInput.trim()}”`);
    }

    return tags;
  }, [searchInput, searchParams, selectedSeriesLabel, selectedStatusLabel, sexFilter]);
  const dashboardDrilldownHint = useMemo(() => {
    if (searchParams.get('from') !== 'dashboard') {
      return null;
    }
    if (dashboardDrilldownTags.length === 0) {
      return '来源看板：已同步筛选条件';
    }

    return `来源看板：已套用 ${dashboardDrilldownTags.join(' + ')}`;
  }, [dashboardDrilldownTags, searchParams]);
  const visibleItems = useMemo(() => {
    if (!statusFilter) {
      return items;
    }

    return items.filter((item) => item.needMatingStatus === statusFilter);
  }, [items, statusFilter]);

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

  return (
    <>
      <main className="tenant-mobile-dock-safe-stack space-y-4 pb-10 sm:space-y-6 lg:pb-10">
        <ProductsSharePreviewCard
          sharePreview={sharePreview}
          shareHeroImageUrl={shareHeroImageUrl}
          shareHeroIndex={shareHeroIndex}
          shareOverlayColor={shareOverlayColor}
          activeFilterCount={activeFilterCount}
          useLegacySharePreviewStyle
          showShareConfigEntry
          onHeroIndexChange={setShareHeroIndex}
          onOpenFilter={(event) => {
            setIsCreateDrawerOpen(false);
            openFilterPopover(event, 'below', { toggle: true });
          }}
          onOpenCreate={() => {
            setIsFilterPopoverOpen(false);
            setIsCreateDrawerOpen(true);
          }}
          onOpenShareConfig={() => router.push(`/app/${tenantSlug}/share-presentation`)}
        />

        {dashboardDrilldownHint ? (
          <Card className="rounded-2xl border-[#FFD400]/45 bg-[#FFFBEA] p-3 sm:p-4">
            <p className="text-sm font-semibold text-neutral-900">{dashboardDrilldownHint}</p>
            {dashboardDrilldownTags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {dashboardDrilldownTags.map((tag, index) => (
                  <span
                    key={`dashboard-drilldown-tag-${index}-${tag}`}
                    className="inline-flex items-center rounded-full border border-[#FFD400]/45 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-neutral-600">可继续使用下方筛选 tag 做微调。</p>
          </Card>
        ) : null}

        <ProductsListCard
          listStatsLabel={listStatsLabel}
          showMobileFilterFab={showMobileFilterFab}
          mobileTopFilterRef={mobileTopFilterRef}
          activeFilterCount={activeFilterCount}
          searchInput={searchInput}
          sexFilter={sexFilter}
          seriesFilterId={seriesFilterId}
          statusFilter={statusFilter}
          selectedSeriesLabel={selectedSeriesLabel}
          selectedStatusLabel={selectedStatusLabel}
          quickSeriesOptions={quickSeriesOptions}
          hasMoreSeriesOptions={hasMoreSeriesOptions}
          loading={loading}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          visibleItems={visibleItems}
          total={meta.total}
          loadMoreSentinelRef={loadMoreSentinelRef}
          onOpenFilter={openFilterPopover}
          onClearSearch={() => setSearchInput('')}
          onSexFilterChange={setSexFilter}
          onSeriesFilterChange={setSeriesFilterId}
          onStatusFilterChange={setStatusFilter}
          onOpenEdit={openEdit}
          onOpenPreviewDetail={openPreviewDetail}
        />

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
          <FloatingActionDock className="lg:hidden">
            <FloatingActionButton
              aria-label="新建产品"
              onClick={() => {
                setIsFilterPopoverOpen(false);
                setIsCreateDrawerOpen(true);
              }}
            >
              <Plus size={18} />
            </FloatingActionButton>
            <TenantFloatingShareButton
              intent="feed"
              inline
              className="h-11 w-11"
              previewImageUrl={shareHeroImageUrl}
              posterImageUrls={sharePosterImageUrls}
            />
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
                  <Search size={18} />
                </Button>
                {activeFilterCount > 0 ? (
                  <span className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FFD400] px-1 text-[11px] font-semibold text-neutral-900 shadow-[0_10px_18px_rgba(0,0,0,0.18)] ring-1 ring-black/10">
                    {activeFilterCount}
                  </span>
                ) : null}
              </div>
            ) : null}
          </FloatingActionDock>
        ) : null}
      </main>

      <ProductsFilterOverlay
        isOpen={isFilterPopoverOpen}
        isMobileSheet={isMobileFilterLayout && showMobileFilterFab}
        placement={filterPopoverPlacement}
        anchorRect={filterPopoverAnchorRect}
        searchInput={searchInput}
        sexFilter={sexFilter}
        statusFilter={statusFilter}
        seriesFilterId={seriesFilterId}
        quickSeriesOptions={quickSeriesOptions}
        seriesOptions={seriesOptions}
        hasMoreSeriesOptions={hasMoreSeriesOptions}
        onSearchInputChange={setSearchInput}
        onSexFilterChange={setSexFilter}
        onStatusFilterChange={setStatusFilter}
        onSeriesFilterChange={setSeriesFilterId}
        onClose={() => setIsFilterPopoverOpen(false)}
        onReset={handleResetSearch}
      />

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
