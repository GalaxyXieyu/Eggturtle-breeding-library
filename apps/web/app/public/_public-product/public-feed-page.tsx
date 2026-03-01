'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PublicSharePresentation } from '@eggturtle/shared';

import type { Breeder, NeedMatingStatus, Series } from './types';
import { BreederCard, DemoHint, PublicEmptyState, SeriesIntroCard, ShareContactCard } from './components';
import { resolvePublicSharePresentation } from './presentation';

type Props = {
  demo: boolean;
  shareToken: string;
  shareQuery?: string;
  series: Series[];
  breeders: Breeder[];
  presentation?: PublicSharePresentation | null;
};

function rankStatus(status: NeedMatingStatus) {
  return status === 'warning' ? 1 : 0;
}

export default function PublicFeedPage({ demo, shareToken, shareQuery, series, breeders, presentation }: Props) {
  const [seriesId, setSeriesId] = useState<string>(series[0]?.id || '');
  const [sex, setSex] = useState<'all' | 'male' | 'female'>('all');
  const [status, setStatus] = useState<'all' | NeedMatingStatus>('all');

  const resolvedPresentation = resolvePublicSharePresentation(presentation);
  const heroImages = resolvedPresentation.hero.images;
  const heroSignature = useMemo(() => heroImages.join('|'), [heroImages]);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    setHeroIndex(0);
  }, [heroSignature]);

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

  const list = useMemo(() => {
    const bySeries = seriesId ? breeders.filter((item) => item.seriesId === seriesId) : breeders;
    const bySex = sex === 'all' ? bySeries : bySeries.filter((item) => item.sex === sex);
    const byStatus = status === 'all' ? bySex : bySex.filter((item) => (item.needMatingStatus || 'normal') === status);

    if (status !== 'all') return byStatus;

    return byStatus
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const bySeverity = rankStatus(b.item.needMatingStatus || 'normal') - rankStatus(a.item.needMatingStatus || 'normal');
        if (bySeverity !== 0) return bySeverity;
        return a.index - b.index;
      })
      .map((item) => item.item);
  }, [breeders, seriesId, sex, status]);

  const activeSeries = useMemo(() => series.find((item) => item.id === seriesId) || null, [series, seriesId]);

  const brandPrimary = resolvedPresentation.theme.brandPrimary;
  const brandSecondary = resolvedPresentation.theme.brandSecondary;
  const activeButtonShadow = `0 6px 20px ${hexToRgba(brandPrimary, 0.22)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 text-black">
      <div className="w-full px-1 pb-8 pt-[calc(env(safe-area-inset-top)+8px)] sm:px-3 lg:px-5 2xl:px-6">
        <header className="mb-3 overflow-hidden bg-neutral-900 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:rounded-2xl">
          <div className="relative h-[240px] lg:h-[320px]">
            <div
              className="absolute inset-0 bg-cover bg-center transition-all duration-500"
              style={{
                backgroundImage: `url(${heroImages[heroIndex] || '/images/mg_04.jpg'})`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-black/40" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${hexToRgba(brandSecondary, 0.18)}, transparent 52%)` }} />
            <div className="absolute inset-0">
              <div className="flex h-full flex-col justify-end p-5 lg:p-8">
                <div className="text-xs uppercase tracking-widest text-white/70">public share</div>
                <h1 className="mt-2 text-[26px] font-semibold leading-tight text-white drop-shadow-sm lg:text-[34px]">{resolvedPresentation.feedTitle}</h1>
                <div className="mt-2 text-sm leading-relaxed text-white/80 lg:text-base">{resolvedPresentation.feedSubtitle}</div>
              </div>
            </div>

            {heroImages.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="上一张"
                  className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-1.5 text-sm font-semibold text-neutral-900 shadow hover:bg-white"
                  onClick={() => setHeroIndex((index) => (index - 1 + heroImages.length) % heroImages.length)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="下一张"
                  className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-1.5 text-sm font-semibold text-neutral-900 shadow hover:bg-white"
                  onClick={() => setHeroIndex((index) => (index + 1) % heroImages.length)}
                >
                  ›
                </button>
                <div className="absolute bottom-3 right-3 z-20 flex gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-sm">
                  {heroImages.map((_, index) => (
                    <button
                      key={`hero-dot-${index}`}
                      type="button"
                      aria-label={`切换到第 ${index + 1} 张`}
                      onClick={() => setHeroIndex(index)}
                      className={`h-1.5 rounded-full transition-all ${index === heroIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/55'}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </header>

        <DemoHint demo={demo} />

        <div className="sticky z-30 mb-3 border border-black/5 bg-white/95 px-3 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 sm:rounded-2xl" style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-medium text-neutral-600">系列</div>
              <div className="flex flex-wrap gap-2">
                {series.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSeriesId(item.id)}
                    className={`h-8 rounded-full border px-3 text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] transition lg:h-9 lg:px-4 lg:text-sm ${
                      seriesId === item.id
                        ? 'bg-white font-semibold'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:shadow-sm'
                    }`}
                    style={
                      seriesId === item.id
                        ? {
                            borderColor: brandPrimary,
                            color: brandSecondary,
                            boxShadow: activeButtonShadow
                          }
                        : undefined
                    }
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs font-medium text-neutral-600">性别</div>
              <div className="flex gap-2">
                {[
                  { key: 'all' as const, label: '全部' },
                  { key: 'female' as const, label: '种母' },
                  { key: 'male' as const, label: '种公' }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSex(item.key)}
                    className={`h-8 rounded-full border px-3 text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] transition lg:h-9 lg:px-4 lg:text-sm ${
                      sex === item.key
                        ? 'bg-white font-semibold'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:shadow-sm'
                    }`}
                    style={
                      sex === item.key
                        ? {
                            borderColor: brandPrimary,
                            color: brandSecondary,
                            boxShadow: activeButtonShadow
                          }
                        : undefined
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs font-medium text-neutral-600">状态</div>
              <div className="flex gap-2">
                {[
                  { key: 'all' as const, label: '全部' },
                  { key: 'need_mating' as const, label: '待配' },
                  { key: 'warning' as const, label: '⚠️逾期未交配' }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStatus(item.key)}
                    className={`h-8 rounded-full border px-3 text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] transition lg:h-9 lg:px-4 lg:text-sm ${
                      status === item.key
                        ? 'bg-white font-semibold'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:shadow-sm'
                    }`}
                    style={
                      status === item.key
                        ? {
                            borderColor: brandPrimary,
                            color: brandSecondary,
                            boxShadow: activeButtonShadow
                          }
                        : undefined
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <SeriesIntroCard series={activeSeries} breeders={list} />

        {list.length === 0 ? (
          <PublicEmptyState message={demo ? '当前筛选条件下暂无数据' : '当前分享暂无可展示内容'} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4 xl:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
            {list.map((breeder) => (
              <BreederCard
                key={breeder.id}
                breeder={breeder}
                demo={demo}
                shareToken={shareToken}
                shareQuery={shareQuery}
              />
            ))}
          </div>
        )}

        <ShareContactCard presentation={resolvedPresentation} className="mt-4" />
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
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
