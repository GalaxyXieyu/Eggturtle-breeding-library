/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicSharePresentation } from '@eggturtle/shared';

import { PetCard } from '@/components/pet';
import { FamilyNodeCard } from '@/components/family-tree/FamilyNodeCard';
import { formatSex, formatShortDate } from '@/lib/pet-format';
import { sanitizeEventNoteForDisplay } from '@/lib/breeder-utils';
import type { Breeder, BreederEventItem, FamilyTree, MaleMateLoadItem, NeedMatingStatus, Series } from '@/app/public/_public-product/types';
import { withPublicImageMaxEdge } from '@/app/public/_shared/public-image';
import PublicImageWithRetry from '@/app/public/_shared/PublicImageWithRetry';

function withDemo(path: string, demo: boolean) {
  return demo ? `${path}${path.includes('?') ? '&' : '?'}demo=1` : path;
}

function withShareQuery(path: string, shareQuery?: string) {
  if (!shareQuery) {
    return path;
  }

  return `${path}${path.includes('?') ? '&' : '?'}${shareQuery}`;
}

function publicPath(shareToken: string, subpath = '', shareQuery?: string) {
  return withShareQuery(`/public/s/${shareToken}${subpath}`, shareQuery);
}

function statusBadge(status: NeedMatingStatus, daysSinceEgg?: number | null) {
  if (status === 'warning') {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
        ⚠️逾期未交配{typeof daysSinceEgg === 'number' ? ` 第${daysSinceEgg}天` : ''}
      </span>
    );
  }

  if (status === 'need_mating') {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
        待配{typeof daysSinceEgg === 'number' ? ` 第${daysSinceEgg}天` : ''}
      </span>
    );
  }

  return null;
}

export function PublicEmptyState({ message }: { message: string }) {
  return <div className="rounded-xl border border-neutral-200 p-6 text-sm text-neutral-600">{message}</div>;
}

export function DemoHint({ demo }: { demo: boolean }) {
  if (demo) {
    return (
      <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-900">
        demo=1 模式：当前页面使用本地 mock 数据渲染，仅用于 UI 迁移验收。
      </div>
    );
  }

  return null;
}

export function ShareContactCard({
  presentation,
  className
}: {
  presentation: PublicSharePresentation;
  className?: string;
}) {
  const { showWechatBlock, wechatQrImageUrl, wechatId } = presentation.contact;
  const contactQrImageUrl = withPublicImageMaxEdge(wechatQrImageUrl, 480);

  if (!showWechatBlock) {
    return null;
  }

  if (!contactQrImageUrl && !wechatId) {
    return null;
  }

  return (
    <section className={`rounded-3xl border border-black/5 bg-white/90 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.08)] sm:p-5 ${className ?? ''}`}>
      <div className="flex flex-wrap items-start gap-4">
        {contactQrImageUrl ? (
          <PublicImageWithRetry
            src={contactQrImageUrl}
            alt="微信二维码"
            className="h-28 w-28 rounded-2xl border border-neutral-200 bg-white object-cover p-1"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        ) : null}

        <div className="min-w-0 space-y-1">
          <p className="text-xs uppercase tracking-[0.26em] text-neutral-500">Contact</p>
          <p className="text-lg font-semibold text-neutral-900">微信联系</p>
          {wechatId ? (
            <p className="text-sm text-neutral-700">
              微信号：<span className="font-mono font-medium">{wechatId}</span>
            </p>
          ) : (
            <p className="text-sm text-neutral-600">请扫码添加微信咨询。</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function SeriesIntroCard({
  series,
  breeders,
}: {
  series: Series | null;
  breeders: Breeder[];
}) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const firstImage = withPublicImageMaxEdge(breeders[0]?.images[0]?.url, 640);
  const [coverLoaded, setCoverLoaded] = useState(false);

  if (!series) return null;

  const counts = breeders.reduce(
    (acc, breeder) => {
      if (breeder.sex === 'male') acc.male += 1;
      if (breeder.sex === 'female') acc.female += 1;
      return acc;
    },
    { male: 0, female: 0 }
  );

  const hasDescription = Boolean(series.description?.trim());

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-black/5 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <div className="relative overflow-hidden">
        {firstImage ? (
          <>
            {!coverLoaded ? (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-600 via-neutral-500 to-neutral-600" />
            ) : null}
            <PublicImageWithRetry
              src={firstImage}
              alt={`${series.name} 系列封面`}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${coverLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              onLoadSuccess={() => setCoverLoaded(true)}
              onLoadFailure={() => setCoverLoaded(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/50" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-600" />
        )}

        <div className="relative">
          <div className="flex items-center justify-between px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/70">
              <span>系列介绍</span>
              <div className="ml-1 flex items-center gap-1">
                <div className="text-base font-bold text-white sm:text-lg">{series.name}</div>
                <div className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                  公{counts.male} 母{counts.female}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCollapsed((current) => !current)}
              className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <svg
                className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100'}`}>
            <div className="px-4 pb-3 sm:px-5">
              {hasDescription ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{series.description}</div>
              ) : (
                <p className="text-sm leading-relaxed text-white/70">暂无系列介绍</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BreederCard({
  breeder,
  demo,
  shareToken,
  shareQuery,
}: {
  breeder: Breeder;
  demo: boolean;
  shareToken: string;
  shareQuery?: string;
}) {
  const mainImage = breeder.images.find((item) => item.type === 'main') || breeder.images[0];
  return (
    <PetCard
      href={withDemo(publicPath(shareToken, `/products/${breeder.id}`, shareQuery), demo)}
      variant="public"
      code={breeder.code}
      coverImageUrl={withPublicImageMaxEdge(mainImage?.url, 320) ?? undefined}
      coverFallbackImageUrl="/images/mg_01.jpg"
      coverAlt={breeder.code}
      sex={breeder.sex}
      sexEmptyLabel="-"
      sexUnknownLabel="-"
      needMatingStatus={breeder.needMatingStatus}
      daysSinceEgg={breeder.daysSinceEgg}
      offspringUnitPrice={breeder.offspringUnitPrice}
      lastEggAt={breeder.lastEggAt}
      lastMatingAt={breeder.lastMatingAt}
      description={breeder.description}
    />
  );
}

export function BreederCarousel({
  breeder,
  series,
  demo,
  shareToken,
  shareQuery,
  homeHref
}: {
  breeder: Breeder;
  series: Series | null;
  demo: boolean;
  shareToken: string;
  shareQuery?: string;
  homeHref?: string;
}) {
  const router = useRouter();
  const [slide, setSlide] = useState(series?.description ? 1 : 0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const hasSeriesIntro = Boolean(series?.description);
  const effectiveSlide = hasSeriesIntro ? slide : 0;
  const activeImage = breeder.images[currentImageIndex] || breeder.images[0];
  const activeImageUrl =
    (withPublicImageMaxEdge(activeImage?.url || '/images/mg_01.jpg', 960) as string) ?? '/images/mg_01.jpg';
  const [activeImageLoaded, setActiveImageLoaded] = useState(false);
  const activeImageRef = useRef<HTMLImageElement | null>(null);
  const resolvedHomeHref = homeHref ?? withDemo(publicPath(shareToken, '', shareQuery), demo);

  useEffect(() => {
    setActiveImageLoaded(false);
    if (activeImageRef.current?.complete) {
      setActiveImageLoaded(true);
    }
  }, [activeImageUrl]);

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(resolvedHomeHref);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_14px_38px_rgba(0,0,0,0.14)]">
      <div className="relative aspect-[4/5] bg-neutral-100">
        <button
          type="button"
          onClick={handleBack}
          className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-sm text-neutral-800 shadow-lg backdrop-blur-sm transition hover:bg-white hover:shadow-xl"
        >
          返回
        </button>

        {hasSeriesIntro ? (
          <div className="absolute right-3 top-3 z-10 flex gap-1.5 rounded-full bg-black/40 px-2 py-1.5 backdrop-blur-sm">
            <button type="button" onClick={() => setSlide(0)} className={`h-1.5 rounded-full transition-all ${slide === 0 ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
            <button type="button" onClick={() => setSlide(1)} className={`h-1.5 rounded-full transition-all ${slide === 1 ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
          </div>
        ) : null}

        <div className="flex h-full transition-transform duration-300 ease-out" style={{ transform: `translateX(-${effectiveSlide * 100}%)` }}>
          {hasSeriesIntro ? (
            <div className="h-full w-full shrink-0 overflow-y-auto bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-600 p-5">
              <div className="flex h-full flex-col pt-14 pr-10">
                <div className="text-xs font-medium uppercase tracking-wide text-white/70">系列介绍</div>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div className="text-xl font-bold text-white sm:text-2xl">{series?.name}</div>
                  <button type="button" onClick={() => setSlide(1)} className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                    返回图片
                  </button>
                </div>
                <div className="mt-4 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{series?.description}</div>
              </div>
            </div>
          ) : null}

          <div className="relative h-full w-full shrink-0">
            {!activeImageLoaded ? (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200" />
            ) : null}
            <img
              ref={activeImageRef}
              src={activeImageUrl}
              alt={activeImage?.alt || breeder.code}
              className={`h-full w-full object-cover transition-opacity duration-300 ${activeImageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setActiveImageLoaded(true)}
              onError={() => setActiveImageLoaded(true)}
            />

            {breeder.images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentImageIndex((idx) => Math.max(0, idx - 1))}
                  disabled={currentImageIndex === 0}
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentImageIndex((idx) => Math.min(breeder.images.length - 1, idx + 1))}
                  disabled={currentImageIndex === breeder.images.length - 1}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ›
                </button>
              </>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />

            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {hasSeriesIntro ? (
                  <button type="button" onClick={() => setSlide(0)} className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                    查看系列说明
                  </button>
                ) : null}
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-neutral-900">
                  {formatSex(breeder.sex, { emptyLabel: '-', unknownLabel: '-' })}
                </span>
                {series?.name ? <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">系列 {series.name}</span> : null}
              </div>
              <span className="shrink-0 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                {currentImageIndex + 1}/{breeder.images.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {effectiveSlide === (hasSeriesIntro ? 1 : 0) && breeder.images.length > 1 ? (
        <div className="border-t border-black/5 bg-white/90 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {breeder.images.map((img, index) => (
              <button
                key={img.id || `${img.url}-${index}`}
                type="button"
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-all ${index === currentImageIndex ? 'border-neutral-900' : 'border-transparent'}`}
                onClick={() => setCurrentImageIndex(index)}
              >
                <img
                  src={withPublicImageMaxEdge(img.url, 320) ?? img.url}
                  alt={img.alt || `${breeder.code}-${index + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BreederStatusSummary({ breeder }: { breeder: Breeder }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-700">
      {statusBadge(breeder.needMatingStatus || 'normal', breeder.daysSinceEgg)}
      <span className="text-neutral-500">最近产蛋</span>
      <span className="font-mono">{formatShortDate(breeder.lastEggAt)}</span>
      <span className="text-neutral-300">·</span>
      <span className="text-neutral-500">最近交配</span>
      <span className="font-mono">{formatShortDate(breeder.lastMatingAt)}</span>
    </div>
  );
}

function eventLabel(event: BreederEventItem) {
  if (event.eventType === 'mating') return '交配';
  if (event.eventType === 'egg') return '产蛋';
  return '换公';
}

function eventIcon(eventType: BreederEventItem['eventType']) {
  if (eventType === 'mating') return '🔞';
  if (eventType === 'egg') return '🥚';
  return '🔁';
}

export function BreederEventTimeline({ events, breeder }: { events: BreederEventItem[]; breeder: Breeder }) {
  const [filter, setFilter] = useState<'all' | BreederEventItem['eventType']>('all');
  const [isExpanded, setIsExpanded] = useState(true);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((event) => event.eventType === filter);
  }, [events, filter]);

  return (
    <div className="mt-8 px-3 sm:px-4 lg:px-5 2xl:px-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">种龟事件</h2>
          {statusBadge(breeder.needMatingStatus || 'normal', breeder.daysSinceEgg)}
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-neutral-600 sm:flex-row sm:items-center sm:gap-2 dark:text-neutral-300">
          <span>最近产蛋 {formatShortDate(breeder.lastEggAt)}</span>
          <span className="hidden text-neutral-300 sm:inline dark:text-neutral-600">·</span>
          <span>最近交配 {formatShortDate(breeder.lastMatingAt)}</span>
        </div>
      </div>

      <div className="relative mb-4">
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white p-3 shadow-[0_6px_18px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-neutral-900/75">
          {filtered.length === 0 ? (
            <div className="text-sm text-neutral-500">暂无事件</div>
          ) : (
            <div className="flex w-max flex-row items-center gap-2">
              {filtered.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="group flex w-[14vw] min-w-[54px] max-w-[92px] shrink-0 flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white px-1.5 py-2 shadow-sm transition hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-950/40 dark:hover:bg-neutral-950/55"
                >
                  <span className="text-sm leading-none">{eventIcon(event.eventType)}</span>
                  <span className="text-[10px] font-semibold leading-tight text-neutral-900 dark:text-neutral-100">{formatShortDate(event.eventDate)}</span>
                  <span className="text-[10px] font-semibold leading-tight text-neutral-700 dark:text-neutral-300">{eventLabel(event)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {[
          { key: 'all' as const, title: '全部' },
          { key: 'mating' as const, title: '交配' },
          { key: 'egg' as const, title: '产蛋' },
          { key: 'change_mate' as const, title: '换公' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              filter === item.key
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white/15 dark:bg-neutral-50 dark:text-neutral-950'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 dark:border-white/10 dark:bg-neutral-950/30 dark:text-neutral-200 dark:hover:border-white/20'
            }`}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/75">
        <div className="border-b bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-neutral-950/35">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">记录（已加载 {filtered.length} 条）</div>
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 hover:border-neutral-300 dark:border-white/10 dark:bg-neutral-950/30 dark:text-neutral-200 dark:hover:border-white/20"
            >
              {isExpanded ? '收起' : '展开'}
            </button>
          </div>
        </div>

        {isExpanded ? (
          filtered.length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">暂无记录</div>
          ) : (
            <div className="divide-y dark:divide-white/10">
              {filtered.map((event) => {
                const note = sanitizeEventNoteForDisplay(event.note);

                return (
                <div key={event.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm leading-none">{eventIcon(event.eventType)}</span>
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{eventLabel(event)}</span>
                        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{formatShortDate(event.eventDate)}</span>
                      </div>
                      {/* Public pages should not leak internal meta fields (maleCode/eggCount/mate codes)
                          that may be duplicated into legacy event notes. Keep only sanitized user remarks. */}
                      {note ? <div className="mt-2 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">{note}</div> : null}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

export function MaleMateLoadCard({
  items,
  demo,
  shareToken,
  shareQuery,
}: {
  items: MaleMateLoadItem[];
  demo: boolean;
  shareToken: string;
  shareQuery?: string;
}) {
  const sortedItems = items
    .slice()
    .sort((a, b) => {
      const rank = (status: NeedMatingStatus) => (status === 'warning' ? 2 : status === 'need_mating' ? 1 : 0);
      const bySeverity = rank(b.status) - rank(a.status);
      if (bySeverity !== 0) return bySeverity;

      const bDays = typeof b.daysSinceEgg === 'number' ? b.daysSinceEgg : -1;
      const aDays = typeof a.daysSinceEgg === 'number' ? a.daysSinceEgg : -1;
      return bDays - aDays;
    });

  return (
    <div className="mt-8 px-1 sm:px-3 lg:px-5 2xl:px-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">关联母龟（配偶/负载）</h2>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">关联 {sortedItems.length}</span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">待配 {sortedItems.filter((item) => item.status === 'need_mating').length}</span>
        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">⚠️逾期未交配 {sortedItems.filter((item) => item.status === 'warning').length}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
        {sortedItems.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">暂无关联母龟</div>
        ) : (
          <div className="divide-y">
            {sortedItems.map((item) => (
              <div key={item.femaleId} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link href={withDemo(publicPath(shareToken, `/products/${item.femaleId}`, shareQuery), demo)} className="truncate text-sm font-semibold text-neutral-900 hover:underline">
                      {item.femaleCode}
                    </Link>
                    {statusBadge(item.status, item.daysSinceEgg)}
                  </div>

                  <div className="flex items-center gap-3 text-xs font-medium text-neutral-600">
                    <span>最近产蛋 {formatShortDate(item.lastEggAt)}</span>
                    <span className="text-neutral-300">·</span>
                    <span>最近与本公交配 {formatShortDate(item.lastMatingWithThisMaleAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function FamilyTreeSection({
  familyTree,
  demo,
  shareToken,
  shareQuery,
}: {
  familyTree: FamilyTree | null;
  demo: boolean;
  shareToken: string;
  shareQuery?: string;
}) {
  const [showSiblings, setShowSiblings] = useState(false);
  const treeImageResolver = (url: string) => withPublicImageMaxEdge(url, 480) ?? url;

  return (
    <div className="mt-8 px-1 sm:px-3 lg:px-5 2xl:px-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">家族谱系</h2>
      </div>

      {!familyTree ? (
        <div className="rounded-2xl border border-neutral-200 bg-white/80 p-6 text-center text-sm text-neutral-600">暂无家族树数据（预留布局）。</div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,250,249,0.98))] shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto overflow-y-hidden pb-6">
            <div className="inline-flex gap-5 px-3 py-5 sm:gap-6 sm:px-4 sm:py-6 lg:gap-7 lg:px-5">
              <div className="flex flex-col gap-3.5">
                <div className="text-center text-xs font-medium text-neutral-500">祖辈</div>
                <TreeNode node={familyTree.ancestors.paternalGrandfather} demo={demo} shareToken={shareToken} shareQuery={shareQuery} imageResolver={treeImageResolver} />
                <TreeNode node={familyTree.ancestors.paternalGrandmother} demo={demo} shareToken={shareToken} shareQuery={shareQuery} imageResolver={treeImageResolver} />
                <TreeNode node={familyTree.ancestors.maternalGrandfather} demo={demo} shareToken={shareToken} shareQuery={shareQuery} imageResolver={treeImageResolver} />
                <TreeNode node={familyTree.ancestors.maternalGrandmother} demo={demo} shareToken={shareToken} shareQuery={shareQuery} imageResolver={treeImageResolver} />
              </div>

              <div className="flex flex-col gap-3.5">
                <div className="text-center text-xs font-medium text-neutral-500">父母辈</div>
                <TreeNode node={familyTree.ancestors.father} demo={demo} shareToken={shareToken} shareQuery={shareQuery} imageResolver={treeImageResolver} />
                <TreeNode node={familyTree.ancestors.mother} demo={demo} shareToken={shareToken} shareQuery={shareQuery} imageResolver={treeImageResolver} />
              </div>

              <div className="flex flex-col gap-4">
                <div className="text-center text-xs font-medium text-amber-600">当前</div>
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-amber-300/85 to-orange-300/85 blur-md" />
                    <div className="relative">
                      <TreeNode node={familyTree.current} demo={demo} shareToken={shareToken} shareQuery={shareQuery} imageResolver={treeImageResolver} />
                    </div>
                  </div>
                  {familyTree.currentMate?.id ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-px rounded-full bg-amber-200" />
                      <FamilyNodeCard
                        node={familyTree.currentMate}
                        href={withDemo(publicPath(shareToken, `/products/${familyTree.currentMate.id}`, shareQuery), demo)}
                        className="border-amber-200 bg-amber-50/70 hover:border-amber-300"
                        codeClassName="text-amber-900"
                        size="large"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3.5">
                <div className="text-center text-xs font-medium text-neutral-500">子代</div>
                {familyTree.offspring.length === 0 ? <TreeNode node={null} demo={demo} shareToken={shareToken} shareQuery={shareQuery} imageResolver={treeImageResolver} /> : familyTree.offspring.map((node) => <TreeNode key={node.id} node={node} demo={demo} shareToken={shareToken} shareQuery={shareQuery} imageResolver={treeImageResolver} />)}

                {familyTree.siblings.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowSiblings((current) => !current)}
                    className="rounded-full bg-neutral-200 px-3 py-1 text-[11px] font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-300"
                  >
                    {showSiblings ? '隐藏同辈' : `+${familyTree.siblings.length} 同辈`}
                  </button>
                ) : null}

                {showSiblings ? familyTree.siblings.map((node) => <TreeNode key={node.id} node={node} demo={demo} shareToken={shareToken} shareQuery={shareQuery} imageResolver={treeImageResolver} />) : null}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex justify-center px-3">
            <div className="rounded-t-xl bg-black/60 px-4 py-2 text-xs text-white backdrop-blur-sm">← 左滑查看祖辈 | 右滑查看后代 →</div>
          </div>
        </div>
      )}
    </div>
  );
}

function TreeNode({
  node,
  demo,
  shareToken,
  shareQuery,
  imageResolver,
}: {
  node: FamilyTree['current'] | null | undefined;
  demo: boolean;
  shareToken: string;
  shareQuery?: string;
  imageResolver?: (url: string) => string;
}) {
  const href = node?.id ? withDemo(publicPath(shareToken, `/products/${node.id}`, shareQuery), demo) : undefined;

  return (
    <FamilyNodeCard
      node={node}
      href={href}
      imageResolver={imageResolver}
      size="large"
    />
  );
}
