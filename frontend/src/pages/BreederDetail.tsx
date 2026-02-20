import React from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import WeChatContactFab from '@/components/turtle-album/WeChatContactFab';
import FamilyTreeComponent from '@/components/turtle-album/FamilyTree';

import { createImageUrl } from '@/lib/api';
import { getBreederImagePath } from '@/utils/breederImage';

import { ApiRequestError, turtleAlbumService } from '@/services/turtleAlbumService';
import type { BreederSummary } from '@/types/turtleAlbum';

const isBreederNotFoundError = (error: unknown) => {
  if (error instanceof ApiRequestError && error.status === 404) return true;
  if (error instanceof Error && /not\s*found/i.test(error.message)) return true;
  return false;
};

const sexLabel = (sex?: string | null) => {
  if (sex === 'female') return '种母';
  if (sex === 'male') return '种公';
  return '-';
};

interface BreederCarouselProps {
  mainImage?: { url: string; alt?: string | null } | null;
  breederCode: string;
  breederSex?: string | null;
  activeSeries?: { name: string } | null;
  seriesIntroItems: string[];
}

const BreederCarousel: React.FC<BreederCarouselProps> = ({ mainImage, breederCode, breederSex, activeSeries, seriesIntroItems }) => {
  const [currentSlide, setCurrentSlide] = React.useState(() => (seriesIntroItems.length > 0 ? 1 : 0)); // 0=intro, 1=image

  const hasSeriesIntro = seriesIntroItems.length > 0;

  // Keep currentSlide valid when the intro is (not) present. Data can arrive async.
  React.useEffect(() => {
    if (hasSeriesIntro) {
      // Default to showing the image when intro becomes available.
      if (currentSlide === 0) setCurrentSlide(1);
    } else {
      // If intro disappears, ensure we stay on the image slide.
      if (currentSlide !== 0) setCurrentSlide(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSeriesIntro]);

  // Optional swipe gesture (wide trigger area). Buttons remain the primary affordance.
  const touchStartX = React.useRef<number | null>(null);

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (!hasSeriesIntro) return;
    const startX = touchStartX.current;
    touchStartX.current = null;
    const endX = e.changedTouches[0]?.clientX ?? null;
    if (startX == null || endX == null) return;

    const delta = endX - startX;
    const threshold = 55;

    if (delta > threshold) setCurrentSlide(0);
    if (delta < -threshold) setCurrentSlide(1);
  };

  const effectiveSlide = hasSeriesIntro ? currentSlide : 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_14px_38px_rgba(0,0,0,0.14)]">
      <div
        className="relative aspect-[4/5] bg-neutral-100"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Link
          to="/"
          className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-sm text-neutral-800 shadow-lg backdrop-blur-sm transition hover:bg-white hover:shadow-xl"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>返回</span>
        </Link>

        {/* Slide indicators */}
        {hasSeriesIntro ? (
          <div className="absolute right-3 top-3 z-10 flex gap-1.5 rounded-full bg-black/40 px-2 py-1.5 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => {
                if (hasSeriesIntro) setCurrentSlide(0);
              }}
              className={`h-1.5 rounded-full transition-all ${
                currentSlide === 0 ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
            <button
              type="button"
              onClick={() => {
                if (hasSeriesIntro) setCurrentSlide(1);
              }}
              className={`h-1.5 rounded-full transition-all ${
                currentSlide === 1 ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          </div>
        ) : null}

        {/* Slides container */}
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${effectiveSlide * 100}%)` }}
        >
          {/* Slide 0: Series intro (negative screen) */}
          {hasSeriesIntro ? (
            <div className="h-full w-full shrink-0 overflow-y-auto bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-600 p-5">
              {/* Add top padding so content doesn't sit under the absolute back/indicator controls on mobile. */}
              <div className="flex h-full flex-col pt-14 pr-10">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/70">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span>系列介绍</span>
                </div>

                <div className="mt-2 flex items-start justify-between gap-3">
                  <div className="text-xl font-bold text-white sm:text-2xl">{activeSeries?.name}</div>
                  <button
                    type="button"
                    onClick={() => setCurrentSlide(1)}
                    className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white"
                  >
                    返回图片
                  </button>
                </div>

                <div className="mt-4 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                  {activeSeries?.description || ''}
                </div>
              </div>
            </div>
          ) : null}

          {/* Slide 1: Image (main screen) */}
          <div className="relative h-full w-full shrink-0">
            <img
              src={createImageUrl(mainImage?.url?.trim() || '')}
              alt={mainImage?.alt || breederCode}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
              {hasSeriesIntro ? (
                <button
                  type="button"
                  onClick={() => setCurrentSlide(0)}
                  className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white"
                >
                  查看系列说明
                </button>
              ) : null}

              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-neutral-900">
                {sexLabel(breederSex)}
              </span>
              {activeSeries?.name ? (
                <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                  系列 {activeSeries.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SeriesDescriptionCard: React.FC<{ seriesName: string; seriesIntroItems: string[] }> = ({ seriesName, seriesIntroItems }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="overflow-hidden border border-black/5 bg-white/90 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-5 py-0 text-left transition hover:bg-gradient-to-br hover:from-neutral-50/50 hover:to-transparent sm:px-6"
      >
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>系列描述</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="text-lg font-semibold text-neutral-900 sm:text-xl">{seriesName}</div>
            {seriesIntroItems.length > 0 ? (
              <div className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                {seriesIntroItems.length}条
              </div>
            ) : null}
          </div>
        </div>
        {seriesIntroItems.length > 0 ? (
          <svg
            className={`h-5 w-5 shrink-0 text-neutral-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : null}
      </button>

      {seriesIntroItems.length > 0 ? (
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="border-t border-neutral-200/50 bg-gradient-to-br from-neutral-50/30 to-transparent px-5 pb-0 pt-3 sm:px-6">
            <div className="space-y-2.5">
              {seriesIntroItems.map((line, idx) => (
                <div key={idx} className="flex gap-2.5 text-sm leading-relaxed text-neutral-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-neutral-200/50 px-5 pb-0 sm:px-6">
          <div className="text-sm text-neutral-500">当前系列暂无描述</div>
        </div>
      )}
    </div>
  );
};

const ParentPill: React.FC<{
  label: string;
  variant: 'father' | 'mother';
  code?: string | null;
  query: UseQueryResult<BreederSummary, Error>;
}> = ({ label, variant, code, query }) => {
  const trimmedCode = (code || '').trim();
  const hasCode = !!trimmedCode;

  const isClickable = hasCode && !!query.data?.id;
  const href = isClickable ? `/breeder/${query.data?.id}` : '#';

  let primaryText = '未知';
  let secondaryText: string | null = null;

  if (hasCode) {
    if (query.isFetching) {
      primaryText = trimmedCode;
      secondaryText = '查询中...';
    } else if (query.data) {
      primaryText = query.data.code;
      secondaryText = query.data.name && query.data.name !== query.data.code ? query.data.name : null;
    } else {
      primaryText = trimmedCode;
      secondaryText = '未知';
    }
  }

  const pillBase =
    'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2';

  const enabledColors =
    variant === 'father'
      ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-300'
      : 'bg-pink-500 text-white hover:bg-pink-600 focus:ring-pink-300';

  const disabledColors = 'cursor-not-allowed bg-neutral-200 text-neutral-500';

  const text = (
    <>
      <span className="shrink-0 opacity-90">{label}</span>
      <span className="max-w-[12rem] truncate sm:max-w-[14rem]">{primaryText}</span>
    </>
  );

  const title = secondaryText ? `${label} ${primaryText} - ${secondaryText}` : `${label} ${primaryText}`;

  if (!isClickable) {
    return (
      <button type="button" disabled title={title} className={`${pillBase} ${disabledColors}`}>
        {text}
      </button>
    );
  }

  return (
    <Link to={href} title={title} className={`${pillBase} ${enabledColors}`}>
      {text}
    </Link>
  );
};

const BreederDetail: React.FC = () => {
  const { id } = useParams();
  const breederId = id || '';

  const breederQ = useQuery({
    queryKey: ['turtle-album', 'breeder', breederId],
    queryFn: () => turtleAlbumService.getBreeder(breederId),
    enabled: !!breederId,
    retry: false,
  });

  const seriesQ = useQuery({
    queryKey: ['turtle-album', 'series'],
    queryFn: () => turtleAlbumService.listSeries(),
  });

  const isBreederNotFound = breederQ.isError && isBreederNotFoundError(breederQ.error);

  const familyTreeQ = useQuery({
    queryKey: ['turtle-album', 'breeder-family-tree', breederId],
    queryFn: () => turtleAlbumService.getBreederFamilyTree(breederId),
    enabled: !!breederId && breederQ.isSuccess,
    retry: false,
  });

  const fallbackBreedersQ = useQuery({
    queryKey: ['turtle-album', 'fallback-breeders'],
    queryFn: () => turtleAlbumService.listBreeders({ limit: 8 }),
    enabled: isBreederNotFound,
    retry: false,
  });

  const activeSeries = React.useMemo(() => {
    if (!breederQ.data?.seriesId) return null;
    return (seriesQ.data || []).find((s) => s.id === breederQ.data?.seriesId) || null;
  }, [breederQ.data?.seriesId, seriesQ.data]);

  const seriesIntroItems = React.useMemo(
    () =>
      (activeSeries?.description || '')
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [activeSeries?.description],
  );

  const sireCode = breederQ.data?.sireCode || null;
  const damCode = breederQ.data?.damCode || null;

  const sireBreederQ = useQuery({
    queryKey: ['turtle-album', 'breeder-by-code', sireCode],
    queryFn: () => turtleAlbumService.getBreederByCode((sireCode || '').trim()),
    enabled: !!(sireCode || '').trim(),
    retry: false,
  });

  const damBreederQ = useQuery({
    queryKey: ['turtle-album', 'breeder-by-code', damCode],
    queryFn: () => turtleAlbumService.getBreederByCode((damCode || '').trim()),
    enabled: !!(damCode || '').trim(),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 text-black">
      <WeChatContactFab
        wechat1Id="Siri08888"
        wechat2Id="Awen02222"
        wechat1QrUrl="https://api3.superbed.cn/static/images/2026/0218/d6/6995ae51556e27f1c93a2fd6.jpg"
        wechat2QrUrl="https://api3.superbed.cn/static/images/2026/0218/04/6995afba556e27f1c93a3004.jpg"
      />
      <div className="w-full px-0 pb-8 pt-[env(safe-area-inset-top)] sm:px-0 lg:px-0 2xl:px-0">
        {breederQ.isLoading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white/80 p-5 text-sm text-neutral-600 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">加载中...</div>
        ) : null}

        {breederQ.isError && !isBreederNotFound ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 text-sm text-red-700">
            {(breederQ.error as Error).message}
          </div>
        ) : null}

        {isBreederNotFound ? (
          <div className="space-y-4 rounded-3xl border border-black/5 bg-white/85 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.08)] backdrop-blur sm:p-6">
            <div>
              <div className="text-lg font-semibold text-neutral-900">该详情不存在或已迁移</div>
              <div className="mt-1 text-sm text-neutral-600">
                当前 ID：<span className="font-mono text-xs sm:text-sm">{breederId}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to="/"
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800 transition hover:border-neutral-400 hover:shadow-sm"
              >
                返回首页
              </Link>
            </div>

            {(fallbackBreedersQ.data || []).length > 0 ? (
              <div>
                <div className="mb-2 text-sm font-medium text-neutral-800">你可以先看这些记录：</div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                  {(fallbackBreedersQ.data || []).map((b) => {
                    const mainImagePath = getBreederImagePath(b);
                    return (
                      <Link
                        key={b.id}
                        to={`/breeder/${b.id}`}
                        className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
                      >
                        <div className="relative aspect-[4/5] bg-neutral-100">
                          <img
                            src={createImageUrl(mainImagePath)}
                            alt={b.code}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="p-2.5">
                          <div className="text-sm font-semibold text-neutral-900">{b.code}</div>
                          <div className="text-xs text-neutral-500">{b.name}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {breederQ.data ? (
          <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(340px,420px)_1fr] xl:gap-5">
            <BreederCarousel
              mainImage={{ url: getBreederImagePath(breederQ.data), alt: breederQ.data.code }}
              breederCode={breederQ.data.code}
              breederSex={breederQ.data.sex}
              activeSeries={activeSeries}
              seriesIntroItems={seriesIntroItems}
            />

            <div className="flex flex-col space-y-4">
              <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-black/5 bg-white/90 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                        {breederQ.data.name}
                      </div>
                      {breederQ.data.code !== breederQ.data.name ? (
                        <div className="mt-1 text-sm text-neutral-500 sm:text-base">{breederQ.data.code}</div>
                      ) : null}
                    </div>
                    {typeof breederQ.data.offspringUnitPrice === 'number' ? (
                      <div className="shrink-0 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 px-3.5 py-1.5 text-sm font-bold text-neutral-900 shadow-[0_4px_12px_rgba(251,191,36,0.4)] sm:text-base">
                        子代 ¥ {breederQ.data.offspringUnitPrice}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-neutral-200/70 bg-neutral-50/40 p-3 sm:p-4">
                    <ParentPill label="父本：" variant="father" code={breederQ.data.sireCode} query={sireBreederQ} />
                    <ParentPill label="母本：" variant="mother" code={breederQ.data.damCode} query={damBreederQ} />
                  </div>

                  {breederQ.data.description ? (
                    <div className="mt-4 rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-yellow-50/50 p-3">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-amber-900">
                        {breederQ.data.description}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Family Tree Section */}
        <div className="mt-8 px-1 sm:px-3 lg:px-5 2xl:px-6">
          <div className="mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h2 className="text-lg font-semibold text-neutral-900">家族谱系</h2>
          </div>
          {familyTreeQ.isLoading ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/80 p-6 text-center text-sm text-neutral-600">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></div>
              <div className="mt-2">加载中...</div>
            </div>
          ) : null}
          {familyTreeQ.isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 text-sm text-red-600">
              {(familyTreeQ.error as Error).message}
            </div>
          ) : null}
          {familyTreeQ.data ? (
            <div className="rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
              <FamilyTreeComponent familyTree={familyTreeQ.data} />
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
};

export default BreederDetail;
