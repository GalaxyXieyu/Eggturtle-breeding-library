'use client';

import { useMemo, useState } from 'react';

import type { Breeder, NeedMatingStatus, Series } from './types';
import { BreederCard, DemoHint, PublicEmptyState, SeriesIntroCard } from './components';

type Props = {
  demo: boolean;
  shareToken: string;
  series: Series[];
  breeders: Breeder[];
};

function rankStatus(status: NeedMatingStatus) {
  return status === 'warning' ? 1 : 0;
}

export default function PublicFeedPage({ demo, shareToken, series, breeders }: Props) {
  const [seriesId, setSeriesId] = useState<string>(series[0]?.id || '');
  const [sex, setSex] = useState<'all' | 'male' | 'female'>('all');
  const [status, setStatus] = useState<'all' | NeedMatingStatus>('all');

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 text-black">
      <div className="w-full px-1 pb-8 pt-[calc(env(safe-area-inset-top)+8px)] sm:px-3 lg:px-5 2xl:px-6">
        <header className="mb-3 overflow-hidden bg-neutral-900 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:rounded-2xl">
          <div className="relative h-[240px] lg:h-[320px]">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/images/mg_04.jpg)' }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-black/40" />
            <div className="absolute inset-0">
              <div className="flex h-full flex-col justify-end p-5 lg:p-8">
                <div className="text-xs uppercase tracking-widest text-white/70">turtle album</div>
                <h1 className="mt-2 text-[26px] font-semibold leading-tight text-white drop-shadow-sm lg:text-[34px]">西瑞 · 果核选育溯源记录</h1>
                <div className="mt-2 text-sm leading-relaxed text-white/80 lg:text-base">长期专注果核繁殖选育</div>
              </div>
            </div>
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
                        ? 'border-[#FFD400] bg-white text-black shadow-[0_6px_20px_rgba(255,212,0,0.22)]'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:shadow-sm'
                    }`}
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
                  { key: 'male' as const, label: '种公' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSex(item.key)}
                    className={`h-8 rounded-full border px-3 text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] transition lg:h-9 lg:px-4 lg:text-sm ${
                      sex === item.key
                        ? 'border-[#FFD400] bg-white text-black shadow-[0_6px_20px_rgba(255,212,0,0.22)]'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:shadow-sm'
                    }`}
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
                  { key: 'warning' as const, label: '⚠️逾期未交配' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStatus(item.key)}
                    className={`h-8 rounded-full border px-3 text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] transition lg:h-9 lg:px-4 lg:text-sm ${
                      status === item.key
                        ? 'border-[#FFD400] bg-white text-black shadow-[0_6px_20px_rgba(255,212,0,0.22)]'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:shadow-sm'
                    }`}
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
          <PublicEmptyState message={demo ? '当前筛选条件下暂无数据' : '未接入数据源，请使用 ?demo=1'} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4 xl:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
            {list.map((breeder) => (
              <BreederCard key={breeder.id} breeder={breeder} demo={demo} shareToken={shareToken} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
