import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import WeChatContactFab from '@/components/turtle-album/WeChatContactFab';

import { turtleAlbumService } from '@/services/turtleAlbumService';
import type { Sex } from '@/types/turtleAlbum';

const sexLabel = (sex?: Sex | null) => {
  if (sex === 'male') return '公';
  if (sex === 'female') return '母';
  return '-';
};

const SeriesFeed: React.FC = () => {
  const [seriesId, setSeriesId] = React.useState<string | 'all'>('all');
  const [sex, setSex] = React.useState<Sex | 'all'>('all');
  const femaleRef = React.useRef<HTMLDivElement | null>(null);
  const maleRef = React.useRef<HTMLDivElement | null>(null);

  const seriesQ = useQuery({
    queryKey: ['turtle-album', 'series'],
    queryFn: () => turtleAlbumService.listSeries(),
  });

  const breedersQ = useQuery({
    queryKey: ['turtle-album', 'breeders', { seriesId, sex }],
    queryFn: () =>
      turtleAlbumService.listBreeders({
        seriesId: seriesId === 'all' ? undefined : seriesId,
        sex: sex === 'all' ? undefined : sex,
        limit: 200,
      }),
  });

  return (
    <div className="min-h-screen bg-white text-black">
      <WeChatContactFab
        wechat1Id="Siri08888"
        wechat2Id="Awen02222"
        wechat1QrUrl="https://api3.superbed.cn/static/images/2026/0218/d6/6995ae51556e27f1c93a2fd6.jpg"
        wechat2QrUrl="https://api3.superbed.cn/static/images/2026/0218/04/6995afba556e27f1c93a3004.jpg"
      />
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-[calc(env(safe-area-inset-top)+32px)]">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-widest text-neutral-500">turtle album</div>
          <h1 className="mt-2 text-[26px] font-semibold leading-tight sm:text-3xl">西瑞 · 果核选育溯源记录</h1>
          <div className="mt-2 text-base leading-relaxed text-neutral-600 sm:text-sm">长期专注果核繁殖选育</div>
        </header>

        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-medium text-neutral-600">系列</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSeriesId('all')}
                  className={`h-8 rounded-full border px-3 text-xs ${
                    seriesId === 'all'
                      ? 'border-[#F5C542] bg-[#F5C542] text-black'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  全部
                </button>
                {(seriesQ.data || []).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSeriesId(s.id)}
                    className={`h-8 rounded-full border px-3 text-xs ${
                      seriesId === s.id
                        ? 'border-[#F5C542] bg-[#F5C542] text-black'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {seriesQ.isLoading ? <div className="ml-auto text-xs text-neutral-500">loading...</div> : null}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs font-medium text-neutral-600">性别</div>
              <div className="flex gap-2">
                {(
                  [
                    { key: 'all', label: '全部' },
                    { key: 'female', label: '种母' },
                    { key: 'male', label: '种公' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      if (t.key === 'female') {
                        setSex('all');
                        requestAnimationFrame(() => femaleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                        return;
                      }
                      if (t.key === 'male') {
                        setSex('all');
                        requestAnimationFrame(() => maleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                        return;
                      }
                      setSex(t.key as any);
                    }}
                    className={`h-8 rounded-full border px-3 text-xs ${
                      sex === t.key
                        ? 'border-[#F5C542] bg-[#F5C542] text-black'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {breedersQ.isLoading ? <div className="ml-auto text-xs text-neutral-500">loading...</div> : null}
            </div>

            {seriesQ.isError ? (
              <div className="text-sm text-red-600">series: {(seriesQ.error as Error).message}</div>
            ) : null}
            {breedersQ.isError ? (
              <div className="text-sm text-red-600">breeders: {(breedersQ.error as Error).message}</div>
            ) : null}
          </div>
        </div>

        {(() => {
          const allBreeders = breedersQ.data || [];
          const females = allBreeders.filter((b) => b.sex === 'female');
          const males = allBreeders.filter((b) => b.sex === 'male');

          const Card = ({ b }: { b: (typeof allBreeders)[number] }) => {
            const mainImage = (b.images || []).find((i) => i.type === 'main') || (b.images || [])[0];
            const seriesName = (seriesQ.data || []).find((s) => s.id === b.seriesId)?.name;

            return (
              <Link
                key={b.id}
                to={`/breeder/${b.id}`}
                className="mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:border-neutral-300"
              >
                <div className="relative aspect-square bg-neutral-100">
                  {mainImage?.url ? (
                    <img src={mainImage.url} alt={mainImage.alt || b.code} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-neutral-100" />
                  )}
                  <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-xs text-black">
                    {sexLabel(b.sex)}
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-neutral-900 sm:text-sm">{b.name}</div>
                      <div className="mt-0.5 text-sm text-neutral-500 sm:text-xs">{b.code}</div>
                    </div>
                    {typeof b.offspringUnitPrice === 'number' ? (
                      <div className="shrink-0 text-base font-semibold text-[#D9A516] sm:text-sm">子代 ¥ {b.offspringUnitPrice}</div>
                    ) : null}
                  </div>

                  {b.description ? (
                    <div className="mt-2 line-clamp-2 text-sm text-neutral-700 sm:text-xs">{b.description}</div>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600 sm:text-[11px]">
                    {seriesName ? <span className="rounded-full bg-neutral-100 px-2 py-1">{seriesName}</span> : null}
                    {b.sireCode ? <span className="rounded-full bg-neutral-100 px-2 py-1">父 {b.sireCode}</span> : null}
                    {b.damCode ? <span className="rounded-full bg-neutral-100 px-2 py-1">母 {b.damCode}</span> : null}
                  </div>
                </div>
              </Link>
            );
          };

          const Masonry = ({ list }: { list: typeof allBreeders }) => (
            <div className="columns-2 gap-3 [column-fill:_balance] md:columns-3 lg:columns-4">
              {list.map((b) => (
                <Card key={b.id} b={b} />
              ))}
            </div>
          );

          if (!breedersQ.isLoading && allBreeders.length === 0) {
            return <div className="rounded-xl border border-neutral-200 p-6 text-sm text-neutral-600">暂无数据</div>;
          }

          // When sex=all, show 2 sections. Quick-jump is handled by the sex chips (种母/种公).
          if (sex === 'all') {
            return (
              <div className="space-y-6">
                <div ref={femaleRef}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-neutral-900">种母</div>
                    <div className="text-xs text-neutral-500">{females.length}</div>
                  </div>
                  <Masonry list={females} />
                </div>

                <div ref={maleRef}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-neutral-900">种公</div>
                    <div className="text-xs text-neutral-500">{males.length}</div>
                  </div>
                  <Masonry list={males} />
                </div>
              </div>
            );
          }

          return <Masonry list={allBreeders} />;
        })()}
      </div>
    </div>
  );
};

export default SeriesFeed;
