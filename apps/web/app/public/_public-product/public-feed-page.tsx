/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicSharePresentation } from '@eggturtle/shared';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

import { buildFilterPillClass } from '@/components/filter-pill';
import { FloatingActionButton, modalCloseButtonClass } from '@/components/ui/floating-actions';
import PublicBottomDock, { type PublicDockTab } from '@/app/public/_shared/public-bottom-dock';
import PublicShareFeaturesScreen from '@/app/public/_shared/public-share-features-screen';
import PublicFloatingActions from '@/app/public/_shared/public-floating-actions';
import { withPublicImageMaxEdge } from '@/app/public/_shared/public-image';
import PublicShareMePage from '@/app/public/_shared/public-share-me-page';

import type { Breeder, NeedMatingStatus, Series } from '@/app/public/_public-product/types';
import {
  BreederCard,
  DemoHint,
  PublicEmptyState,
  SeriesIntroCard,
  ShareContactCard,
} from '@/app/public/_public-product/components';
import { resolvePublicSharePresentation } from '@/app/public/_public-product/presentation';

type Props = {
  demo: boolean;
  shareToken: string;
  shareQuery?: string;
  initialSeriesId?: string;
  series: Series[];
  breeders: Breeder[];
  presentation?: PublicSharePresentation | null;
  tenantSlug?: string;
};

const INITIAL_VISIBLE_BREEDERS = 8;
const VISIBLE_BREEDERS_CHUNK = 8;
const LOAD_MORE_ROOT_MARGIN = '640px 0px';
const PUBLIC_FEED_STATE_KEY_PREFIX = 'public-feed-state:v1:';
const PUBLIC_FEED_STATE_TTL_MS = 30 * 60 * 1000;

type PublicFeedPersistedState = {
  savedAt: number;
  seriesId: string;
  sex: 'all' | 'male' | 'female';
  status: 'all' | NeedMatingStatus;
  visibleCount: number;
  scrollY: number;
};

function buildPublicFeedStateKey(shareToken: string, shareQuery?: string): string {
  return `${PUBLIC_FEED_STATE_KEY_PREFIX}${shareToken}:${shareQuery ?? ''}`;
}

function parsePublicFeedPersistedState(raw: string | null): PublicFeedPersistedState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PublicFeedPersistedState>;

    if (
      typeof parsed.savedAt !== 'number' ||
      typeof parsed.seriesId !== 'string' ||
      (parsed.sex !== 'all' && parsed.sex !== 'male' && parsed.sex !== 'female') ||
      (parsed.status !== 'all' &&
        parsed.status !== 'normal' &&
        parsed.status !== 'need_mating' &&
        parsed.status !== 'warning') ||
      typeof parsed.visibleCount !== 'number' ||
      typeof parsed.scrollY !== 'number'
    ) {
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      seriesId: parsed.seriesId,
      sex: parsed.sex,
      status: parsed.status,
      visibleCount: parsed.visibleCount,
      scrollY: parsed.scrollY,
    };
  } catch {
    return null;
  }
}

function rankStatus(status: NeedMatingStatus) {
  return status === 'warning' ? 1 : 0;
}

const ALL_SERIES_ID = '';

export default function PublicFeedPage({
  demo,
  shareToken,
  shareQuery,
  initialSeriesId,
  series,
  breeders,
  presentation,
  tenantSlug,
}: Props) {
  const [seriesId, setSeriesId] = useState<string>(resolveSeriesId(initialSeriesId, series));
  const [sex, setSex] = useState<'all' | 'male' | 'female'>('all');
  const [status, setStatus] = useState<'all' | NeedMatingStatus>('all');
  const [showMobileFilterFab, setShowMobileFilterFab] = useState(false);
  const [activeDockTab, setActiveDockTab] = useState<PublicDockTab>('pets');
  const [isMobileFilterModalOpen, setIsMobileFilterModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_BREEDERS);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const preserveVisibleCountOnFirstListSyncRef = useRef(false);
  const [hasHydratedFeedState, setHasHydratedFeedState] = useState(false);
  const stateStorageKey = useMemo(
    () => buildPublicFeedStateKey(shareToken, shareQuery),
    [shareToken, shareQuery],
  );

  const resolvedPresentation = resolvePublicSharePresentation(presentation);
  const heroImages = useMemo(
    () =>
      resolvedPresentation.hero.images.map(
        (imageUrl) => withPublicImageMaxEdge(imageUrl, 960) ?? imageUrl,
      ),
    [resolvedPresentation.hero.images],
  );
  const heroSignature = useMemo(() => heroImages.join('|'), [heroImages]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const heroImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setHeroIndex(0);
  }, [heroSignature]);

  useEffect(() => {
    setHeroImageLoaded(false);
    if (heroImageRef.current?.complete) {
      setHeroImageLoaded(true);
    }
  }, [heroIndex, heroSignature]);

  useEffect(() => {
    if (heroImages.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroImages.length);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [heroImages]);

  useEffect(() => {
    setSeriesId(resolveSeriesId(initialSeriesId, series));
  }, [initialSeriesId, series]);

  const persistFeedState = useCallback(
    (scrollY: number) => {
      if (typeof window === 'undefined') {
        return;
      }

      const snapshot: PublicFeedPersistedState = {
        savedAt: Date.now(),
        seriesId,
        sex,
        status,
        visibleCount,
        scrollY: Math.max(0, Math.floor(scrollY)),
      };

      try {
        window.sessionStorage.setItem(stateStorageKey, JSON.stringify(snapshot));
      } catch {
        // Ignore storage quota and private mode write errors.
      }
    },
    [seriesId, sex, status, stateStorageKey, visibleCount],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const parsed = parsePublicFeedPersistedState(window.sessionStorage.getItem(stateStorageKey));
    if (!parsed || Date.now() - parsed.savedAt > PUBLIC_FEED_STATE_TTL_MS) {
      setHasHydratedFeedState(true);
      return;
    }

    if (!initialSeriesId) {
      setSeriesId(resolveSeriesId(parsed.seriesId, series));
      setSex(parsed.sex);
      setStatus(parsed.status);
      preserveVisibleCountOnFirstListSyncRef.current = true;
      setVisibleCount((current) => Math.max(current, Math.floor(parsed.visibleCount)));
    }

    const restoreScrollY = Math.max(0, Math.floor(parsed.scrollY));
    if (restoreScrollY > 0) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: restoreScrollY, behavior: 'auto' });
        });
      });
    }

    setHasHydratedFeedState(true);
  }, [initialSeriesId, series, stateStorageKey]);

  useEffect(() => {
    const OPEN_THRESHOLD = 460;
    const CLOSE_THRESHOLD = 320;

    function updateFilterFloatingState() {
      const isMobileViewport = window.matchMedia('(max-width: 1023px)').matches;
      if (!isMobileViewport) {
        setShowMobileFilterFab(false);
        setIsMobileFilterModalOpen(false);
        return;
      }

      setShowMobileFilterFab((current) => {
        const y = window.scrollY;
        const next = current ? y > CLOSE_THRESHOLD : y > OPEN_THRESHOLD;
        if (!next) {
          setIsMobileFilterModalOpen(false);
        }
        return next;
      });
    }

    updateFilterFloatingState();
    window.addEventListener('scroll', updateFilterFloatingState, { passive: true });
    window.addEventListener('resize', updateFilterFloatingState);

    return () => {
      window.removeEventListener('scroll', updateFilterFloatingState);
      window.removeEventListener('resize', updateFilterFloatingState);
    };
  }, []);

  const list = useMemo(() => {
    const bySeries = seriesId ? breeders.filter((item) => item.seriesId === seriesId) : breeders;
    const bySex = sex === 'all' ? bySeries : bySeries.filter((item) => item.sex === sex);
    const byStatus =
      status === 'all'
        ? bySex
        : bySex.filter((item) => (item.needMatingStatus || 'normal') === status);

    if (status !== 'all') return byStatus;

    return byStatus
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const bySeverity =
          rankStatus(b.item.needMatingStatus || 'normal') -
          rankStatus(a.item.needMatingStatus || 'normal');
        if (bySeverity !== 0) return bySeverity;
        return a.index - b.index;
      })
      .map((item) => item.item);
  }, [breeders, seriesId, sex, status]);
  const visibleList = useMemo(
    () => list.slice(0, Math.min(visibleCount, list.length)),
    [list, visibleCount],
  );
  const hasMoreList = visibleList.length < list.length;

  useEffect(() => {
    if (preserveVisibleCountOnFirstListSyncRef.current) {
      preserveVisibleCountOnFirstListSyncRef.current = false;
      setVisibleCount((current) =>
        Math.min(Math.max(current, INITIAL_VISIBLE_BREEDERS), list.length),
      );
      return;
    }

    setVisibleCount(Math.min(INITIAL_VISIBLE_BREEDERS, list.length));
  }, [list]);

  useEffect(() => {
    if (!hasHydratedFeedState) {
      return;
    }

    persistFeedState(window.scrollY);
  }, [hasHydratedFeedState, persistFeedState]);

  useEffect(() => {
    if (!hasHydratedFeedState || typeof window === 'undefined') {
      return;
    }

    let rafId = 0;
    const onScroll = () => {
      if (rafId) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        persistFeedState(window.scrollY);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', onScroll);
    };
  }, [hasHydratedFeedState, persistFeedState]);

  useEffect(() => {
    if (!hasMoreList) {
      return;
    }

    const target = loadMoreSentinelRef.current;
    if (!target || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        setVisibleCount((current) => Math.min(current + VISIBLE_BREEDERS_CHUNK, list.length));
      },
      { rootMargin: LOAD_MORE_ROOT_MARGIN },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasMoreList, list.length]);

  const activeSeries = useMemo(
    () => series.find((item) => item.id === seriesId) || null,
    [series, seriesId],
  );
  const activeFilterCount = Number(Boolean(seriesId)) + Number(sex !== 'all') + Number(status !== 'all');

  const brandPrimary = resolvedPresentation.theme.brandPrimary;
  const brandSecondary = resolvedPresentation.theme.brandSecondary;
  const contactQrImageUrl = resolvedPresentation.contact.showWechatBlock
    ? withPublicImageMaxEdge(resolvedPresentation.contact.wechatQrImageUrl, 480)
    : null;
  const contactWechatId = resolvedPresentation.contact.showWechatBlock
    ? resolvedPresentation.contact.wechatId
    : null;
  const permalink =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/public/s/${shareToken}`
      : `/public/s/${shareToken}`;
  const homeHref = tenantSlug ? `/app/${tenantSlug}` : '/app';

  useEffect(() => {
    if (typeof document === 'undefined' || activeDockTab === 'pets') {
      return undefined;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [activeDockTab]);

  const handleDockTabChange = useCallback((nextTab: PublicDockTab) => {
    setIsMobileFilterModalOpen(false);
    setActiveDockTab(nextTab);
  }, []);

  function renderFilterContent() {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">系列</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSeriesId(ALL_SERIES_ID)}
              className={buildFilterPillClass(seriesId === ALL_SERIES_ID)}
            >
              全部
            </button>
            {series.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSeriesId(item.id)}
                className={buildFilterPillClass(seriesId === item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">性别</div>
          <div className="flex gap-2">
            {[
              { key: 'all' as const, label: '全部' },
              { key: 'female' as const, label: '种母' },
              { key: 'male' as const, label: '种公' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSex(item.key)}
                className={buildFilterPillClass(sex === item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">状态</div>
          <div className="flex gap-2">
            {[
              { key: 'all' as const, label: '全部' },
              { key: 'need_mating' as const, label: '待配' },
              { key: 'warning' as const, label: '⚠️逾期未交配' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatus(item.key)}
                className={buildFilterPillClass(status === item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 text-black dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900/40 dark:text-neutral-100">
      <div className="w-full px-1 pb-[calc(env(safe-area-inset-bottom)+94px)] pt-[calc(env(safe-area-inset-top)+8px)] sm:px-3 lg:px-5 2xl:px-6">
        <header className="mb-3 overflow-hidden bg-neutral-900 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:rounded-2xl">
          <div className="relative h-[240px] lg:h-[320px]">
            {!heroImageLoaded ? (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-500 via-neutral-400 to-neutral-500" />
            ) : null}
            <img
              ref={heroImageRef}
              src={heroImages[heroIndex] || '/images/mg_04.jpg'}
              alt={resolvedPresentation.feedTitle}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${heroImageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setHeroImageLoaded(true)}
              onError={() => setHeroImageLoaded(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-black/40" />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${hexToRgba(brandSecondary, 0.18)}, transparent 52%)`,
              }}
            />
            <div className="absolute inset-0">
              <div className="flex h-full flex-col justify-end p-5 lg:p-8">
                <div className="text-xs uppercase tracking-widest text-white/70">public share</div>
                <h1 className="mt-2 text-[26px] font-semibold leading-tight text-white drop-shadow-sm lg:text-[34px]">
                  {resolvedPresentation.feedTitle}
                </h1>
                <div className="mt-2 text-sm leading-relaxed text-white/80 lg:text-base">
                  {resolvedPresentation.feedSubtitle}
                </div>
              </div>
            </div>

            {heroImages.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="上一张"
                  className="public-carousel-btn left-3"
                  onClick={() =>
                    setHeroIndex((index) => (index - 1 + heroImages.length) % heroImages.length)
                  }
                >
                  <ChevronLeft size={18} strokeWidth={2.3} />
                </button>
                <button
                  type="button"
                  aria-label="下一张"
                  className="public-carousel-btn right-3"
                  onClick={() => setHeroIndex((index) => (index + 1) % heroImages.length)}
                >
                  <ChevronRight size={18} strokeWidth={2.3} />
                </button>
                <div className="public-carousel-dots">
                  {heroImages.map((_, index) => (
                    <button
                      key={`hero-dot-${index}`}
                      type="button"
                      aria-label={`切换到第 ${index + 1} 张`}
                      onClick={() => setHeroIndex(index)}
                      className={`public-carousel-dot ${index === heroIndex ? 'is-active' : ''}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </header>

        <DemoHint demo={demo} />

        {showMobileFilterFab ? null : (
          <div className="z-20 mb-3 border border-black/5 bg-white/95 px-3 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 sm:rounded-2xl dark:border-white/10 dark:bg-neutral-900/70 supports-[backdrop-filter]:dark:bg-neutral-900/60">
            {renderFilterContent()}
          </div>
        )}
        {showMobileFilterFab ? (
          <div className="mb-3 hidden border border-black/5 bg-white/95 px-3 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 lg:block lg:rounded-2xl dark:border-white/10 dark:bg-neutral-900/70 supports-[backdrop-filter]:dark:bg-neutral-900/60">
            {renderFilterContent()}
          </div>
        ) : null}

        {isMobileFilterModalOpen ? (
          <div
            className="fixed inset-0 z-[70] flex items-end bg-black/35 p-3 sm:items-center sm:justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="筛选宠物"
            onClick={() => setIsMobileFilterModalOpen(false)}
          >
            <div
              className="mx-auto w-[min(92vw,38rem)] max-h-[86vh] overflow-y-auto rounded-3xl border border-neutral-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,245,236,0.95))] p-4 shadow-2xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(23,23,23,0.98),rgba(10,10,10,0.96))]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    筛选宠物
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    选择条件后会实时更新列表。
                  </p>
                </div>
                <div className={buildFilterPillClass(activeFilterCount > 0, { className: 'shrink-0 text-[11px]' })}>
                  {activeFilterCount > 0 ? `已选 ${activeFilterCount} 项` : '全部结果'}
                </div>
                <button
                  type="button"
                  className={modalCloseButtonClass}
                  aria-label="关闭筛选"
                  onClick={() => setIsMobileFilterModalOpen(false)}
                >
                  <X size={17} strokeWidth={2.6} />
                </button>
              </div>
              {renderFilterContent()}
            </div>
          </div>
        ) : null}

        <SeriesIntroCard series={activeSeries} breeders={list} />

        {list.length === 0 ? (
          <PublicEmptyState message={demo ? '当前筛选条件下暂无数据' : '当前分享暂无可展示内容'} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4 xl:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
              {visibleList.map((breeder) => (
                <div
                  key={breeder.id}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '300px 420px' }}
                >
                  <BreederCard
                    breeder={breeder}
                    demo={demo}
                    shareToken={shareToken}
                    shareQuery={shareQuery}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-xs text-neutral-500">
                已加载 {visibleList.length} / {list.length}
              </p>
              {hasMoreList ? (
                <button
                  type="button"
                  className="public-btn-primary"
                  onClick={() =>
                    setVisibleCount((current) =>
                      Math.min(current + VISIBLE_BREEDERS_CHUNK, list.length),
                    )
                  }
                >
                  继续加载
                </button>
              ) : null}
              {hasMoreList ? (
                <div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden />
              ) : null}
            </div>
          </>
        )}

        <ShareContactCard presentation={resolvedPresentation} className="mt-4" />
      </div>
      {activeDockTab === 'pets' ? (
        <PublicFloatingActions
          permalink={permalink}
          homeHref={homeHref}
          showHomeButton={false}
          tenantQrImageUrl={contactQrImageUrl}
          tenantWechatId={contactWechatId}
          shareCardTitle={resolvedPresentation.feedTitle}
          shareCardSubtitle={resolvedPresentation.feedSubtitle}
          shareCardPrimaryColor={brandPrimary}
          shareCardSecondaryColor={brandSecondary}
          shareCardHeroImageUrl={heroImages[heroIndex] ?? heroImages[0] ?? null}
        >
          {showMobileFilterFab ? (
            <FloatingActionButton
              className="lg:hidden"
              aria-label="打开筛选"
              onClick={() => setIsMobileFilterModalOpen(true)}
            >
              <Search size={18} />
            </FloatingActionButton>
          ) : null}
        </PublicFloatingActions>
      ) : null}
      {activeDockTab === 'features' ? (
        <div className="fixed inset-x-0 top-0 bottom-[calc(env(safe-area-inset-bottom)+74px)] z-[60] overflow-y-auto bg-white lg:hidden">
          <PublicShareFeaturesScreen
            shareToken={shareToken}
            shareQuery={shareQuery}
            presentation={presentation}
            embedded
          />
        </div>
      ) : null}
      {activeDockTab === 'me' ? (
        <div className="fixed inset-x-0 top-0 bottom-[calc(env(safe-area-inset-bottom)+74px)] z-[60] overflow-y-auto bg-gradient-to-br from-stone-100 via-white to-amber-50/40 lg:hidden">
          <PublicShareMePage
            shareToken={shareToken}
            shareQuery={shareQuery}
            presentation={presentation}
            embedded
          />
        </div>
      ) : null}
      <PublicBottomDock
        shareToken={shareToken}
        shareQuery={shareQuery}
        activeTab={activeDockTab}
        clientTabKeys={['features', 'pets', 'me']}
        onTabChange={handleDockTabChange}
      />
    </div>
  );
}

function resolveSeriesId(initialSeriesId: string | undefined, series: Series[]): string {
  if (!initialSeriesId) {
    return ALL_SERIES_ID;
  }

  if (series.some((item) => item.id === initialSeriesId)) {
    return initialSeriesId;
  }

  return ALL_SERIES_ID;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${Number.isNaN(red) ? 255 : red}, ${Number.isNaN(green) ? 212 : green}, ${Number.isNaN(blue) ? 0 : blue}, ${alpha})`;
}
