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

  const [isHeroCollapsed, setIsHeroCollapsed] = React.useState(false);

  React.useEffect(() => {
    let raf = 0;

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Collapse hero after a small scroll threshold; keeps the page feeling responsive.
        setIsHeroCollapsed(window.scrollY > 40);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

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
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-[calc(env(safe-area-inset-top)+12px)]">
        <header
          className={`mb-4 overflow-hidden rounded-3xl bg-neutral-900 transition-[max-height,opacity,transform] duration-300 ease-out ${
            isHeroCollapsed ? 'max-h-20 opacity-0 -translate-y-2' : 'max-h-[220px] opacity-100 translate-y-0'
          }`}
        >
          <div className="relative h-[220px]">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: 'url(/turtle-hero.jpg)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/30 to-white/5" />
            <div className="absolute inset-0">
              <div className="flex h-full flex-col justify-end p-5">
                <div className="text-xs uppercase tracking-widest text-white/70">turtle album</div>
                <h1 className="mt-2 text-[26px] font-semibold leading-tight text-white drop-shadow-sm">西瑞 · 果核选育溯源记录</h1>
                <div className="mt-2 text-sm leading-relaxed text-white/80">长期专注果核繁殖选育</div>
              </div>
            </div>
          </div>
        </header>

        <div
          className="sticky z-30 mb-6 rounded-2xl bg-white/80 p-4 backdrop-blur supports-[backdrop-filter]:bg-white/70"
          style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-medium text-neutral-600">系列</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSeriesId('all')}
                  className={`h-8 rounded-full border px-3 text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] ${
                    seriesId === 'all'
                      ? 'border-[#FFD400] bg-white text-black'
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
                    className={`h-8 rounded-full border px-3 text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] ${
                      seriesId === s.id
                        ? 'border-[#FFD400] bg-white text-black'
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
                    className={`h-8 rounded-full border px-3 text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] ${
                      sex === t.key
                        ? 'border-[#FFD400] bg-white text-black'
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

            return (
              <Link
                key={b.id}
                to={`/breeder/${b.id}`}
                className="mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:border-neutral-300"
              >
                <div className="relative aspect-[4/5] bg-neutral-100">
                  {mainImage?.url ? (
                    <img src={mainImage.url} alt={mainImage.alt || b.code} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-neutral-100" />
                  )}
                  <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-xs text-black">
                    {sexLabel(b.sex)}
                  </div>
                  {/* price moved below */}
                </div>

                <div className="p-3">
                  <div className="text-sm font-semibold text-neutral-900">{b.code}</div>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {b.description ? (
                      <span className="inline-flex max-w-full rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
                        <span className="truncate">{b.description}</span>
                      </span>
                    ) : null}
                    {typeof b.offspringUnitPrice === 'number' ? (
                      <span className="inline-flex rounded-full bg-neutral-900/80 px-2 py-1 text-xs font-semibold text-[#FFD400] ring-1 ring-white/10">
                        子代 ¥ {b.offspringUnitPrice}
                      </span>
                    ) : null}
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
