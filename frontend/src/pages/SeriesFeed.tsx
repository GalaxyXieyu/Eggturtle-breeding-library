import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import WeChatContactFab from '@/components/turtle-album/WeChatContactFab';

import { createImageUrl } from '@/lib/api';
import { getBreederImagePath } from '@/utils/breederImage';

import { turtleAlbumService } from '@/services/turtleAlbumService';
import type { Breeder, Sex } from '@/types/turtleAlbum';

const sexLabel = (sex?: Sex | null) => {
  if (sex === 'male') return '公';
  if (sex === 'female') return '母';
  return '-';
};

interface SeriesIntroCardProps {
  seriesId?: string | null;
  seriesName?: string;
  seriesDescription?: string;
  counts?: { male: number; female: number; unknown: number };
  breeders: Breeder[];
}

const SeriesIntroCard: React.FC<SeriesIntroCardProps> = ({ seriesId, seriesName, seriesDescription, counts, breeders }) => {
  // Default-collapsed to keep scrolling smooth on mobile; user can expand via chevron.
  const [isManuallyCollapsed, setIsManuallyCollapsed] = React.useState(true);
  const [hasManuallyInteracted, setHasManuallyInteracted] = React.useState(false);
  const [isScrollCollapsed, setIsScrollCollapsed] = React.useState(false);

  React.useEffect(() => {
    // Keep intro collapsed when switching series (avoid auto-expanding on load).
    setIsManuallyCollapsed(true);
    setHasManuallyInteracted(false);
  }, [seriesId]);

  React.useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Keep auto-collapse behavior only before user manually toggles.
        if (!hasManuallyInteracted) {
          setIsScrollCollapsed(window.scrollY > 200);
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [hasManuallyInteracted]);

  React.useEffect(() => {
    // Once the user has interacted, never keep the card hidden due to prior scroll state.
    if (hasManuallyInteracted) setIsScrollCollapsed(false);
  }, [hasManuallyInteracted]);

  const desc = (seriesDescription || '').trim();
  if (!desc) return null;

  const firstBreeder = breeders[0];
  const bgImage = firstBreeder?.images?.find((i) => i.type === 'main') || firstBreeder?.images?.[0];

  const isContentCollapsed = isManuallyCollapsed;
  const isFullyHidden = isScrollCollapsed;

  return (
    <div
      className={`mb-3 overflow-hidden rounded-2xl border border-black/5 shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-500 ${
        isFullyHidden
          ? 'max-h-0 opacity-0 -translate-y-4'
          : isContentCollapsed
          ? 'max-h-[80px] opacity-100 translate-y-0'
          : 'max-h-[800px] opacity-100 translate-y-0'
      }`}
    >
      <div className="relative overflow-hidden">
        {bgImage?.url ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${createImageUrl(bgImage.url)})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/50" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-600" />
        )}

        <div className="relative">
          <div className="flex items-center justify-between px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/70">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>系列介绍</span>
              <div className="ml-1 flex items-center gap-1">
                <div className="text-base font-bold text-white sm:text-lg">{seriesName}</div>
                <div className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                  {counts ? `公${counts.male} 母${counts.female}` + (counts.unknown ? ` 未知${counts.unknown}` : '') : ''}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setHasManuallyInteracted(true);
                // If the card was auto-hidden by scroll, bring it back when the user explicitly toggles.
                setIsScrollCollapsed(false);
                setIsManuallyCollapsed((prev) => !prev);
              }}
              className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <svg
                className={`h-4 w-4 transition-transform ${isContentCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 ${
              isContentCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100'
            }`}
          >
            <div className="px-4 pb-3 sm:px-5">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{desc}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SeriesFeed: React.FC = () => {
  const [seriesId, setSeriesId] = React.useState<string | null>(null);
  const [sex, setSex] = React.useState<Sex | 'all'>('all');

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

  const SERIES_ID_STORAGE_KEY = 'turtle-album.seriesId';

  // Default series selection:
  // 1) Prefer user's last selected series (localStorage)
  // 2) Otherwise pick the first series that actually has data (probe with limit=1)
  // 3) Fallback to the first series
  React.useEffect(() => {
    if (seriesId) return;
    const list = seriesQ.data || [];
    if (list.length === 0) return;

    const cached = (() => {
      try {
        return window.localStorage.getItem(SERIES_ID_STORAGE_KEY);
      } catch {
        return null;
      }
    })();

    if (cached && list.some((s) => s.id === cached)) {
      setSeriesId(cached);
      return;
    }

    let cancelled = false;

    (async () => {
      // Probe a few series to avoid a cold-open "暂无数据" first impression.
      const candidates = list.slice(0, 5);
      for (const s of candidates) {
        try {
          const res = await turtleAlbumService.listBreeders({ seriesId: s.id, limit: 1 });
          if (cancelled) return;
          if (res.length > 0) {
            setSeriesId(s.id);
            return;
          }
        } catch {
          // Ignore probe errors; we'll fallback.
        }
      }

      if (!cancelled) setSeriesId(list[0].id);
    })();

    return () => {
      cancelled = true;
    };
  }, [seriesId, seriesQ.data]);

  React.useEffect(() => {
    if (!seriesId) return;
    try {
      window.localStorage.setItem(SERIES_ID_STORAGE_KEY, seriesId);
    } catch {
      // ignore
    }
  }, [seriesId]);

  const breedersQ = useQuery({
    queryKey: ['turtle-album', 'breeders', { seriesId, sex }],
    enabled: !!seriesId,
    queryFn: () =>
      turtleAlbumService.listBreeders({
        seriesId: seriesId || undefined,
        sex: sex === 'all' ? undefined : sex,
        limit: 200,
      }),
  });

  const filteredBreeders = React.useMemo(() => {
    const list = breedersQ.data || [];
    const bySex = sex === 'all' ? list : list.filter((b) => b.sex === sex);
    return bySex;
  }, [breedersQ.data, sex]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 text-black">
      <WeChatContactFab
        wechat1Id="Siri08888"
        wechat2Id="Awen02222"
        wechat1QrUrl="https://api3.superbed.cn/static/images/2026/0218/d6/6995ae51556e27f1c93a2fd6.jpg"
        wechat2QrUrl="https://api3.superbed.cn/static/images/2026/0218/04/6995afba556e27f1c93a3004.jpg"
      />
      <div className="w-full px-1 pb-8 pt-[calc(env(safe-area-inset-top)+8px)] sm:px-3 lg:px-5 2xl:px-6">
        <header
          className={`mb-3 overflow-hidden bg-neutral-900 transition-[max-height,opacity,transform] duration-300 ease-out shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:rounded-2xl ${
            isHeroCollapsed ? 'max-h-20 opacity-0 -translate-y-2' : 'max-h-[240px] opacity-100 translate-y-0 lg:max-h-[320px]'
          }`}
        >
          <div className="relative h-[240px] lg:h-[320px]">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: 'url(/turtle-hero.jpg)' }}
            />
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

        <div
          className="sticky z-30 mb-3 border border-black/5 bg-white/95 px-3 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 sm:rounded-2xl"
          style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-medium text-neutral-600">系列</div>
              <div className="flex flex-wrap gap-2">
                {(seriesQ.data || []).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSeriesId(s.id)}
                    className={`h-8 rounded-full border px-3 text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] transition lg:h-9 lg:px-4 lg:text-sm ${
                      seriesId === s.id
                        ? 'border-[#FFD400] bg-white text-black shadow-[0_6px_20px_rgba(255,212,0,0.22)]'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:shadow-sm'
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
                    onClick={() => setSex(t.key)}
                    className={`h-8 rounded-full border px-3 text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] transition lg:h-9 lg:px-4 lg:text-sm ${
                      sex === t.key
                        ? 'border-[#FFD400] bg-white text-black shadow-[0_6px_20px_rgba(255,212,0,0.22)]'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:shadow-sm'
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
          const allBreeders = filteredBreeders;

          const Card = ({ b }: { b: (typeof allBreeders)[number] }) => {
            const mainImagePath = getBreederImagePath(b);

            return (
              <Link
                key={b.id}
                to={`/breeder/${b.id}`}
                className="group w-full overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition active:scale-[0.995] hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_12px_34px_rgba(0,0,0,0.14)]"
              >
                <div className="relative aspect-[4/5] bg-neutral-100">
                  <img
                    src={createImageUrl(mainImagePath)}
                    alt={b.code}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
                  <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-xs text-black">
                    {sexLabel(b.sex)}
                  </div>
                  {/* price moved below */}
                </div>

                <div className="p-3 lg:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 text-sm font-semibold tracking-wide text-neutral-900 sm:text-base lg:text-lg">{b.code}</div>
                    {typeof b.offspringUnitPrice === 'number' ? (
                      <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold leading-5 text-[#FFD400] ring-1 ring-white/10 sm:text-xs">
                        子代 ¥ {b.offspringUnitPrice}
                      </span>
                    ) : null}
                  </div>

                  {b.description ? (
                    <div className="mt-2 rounded-xl bg-neutral-100/80 px-2.5 py-1.5 text-xs leading-relaxed text-neutral-700 sm:text-sm">
                      <span className="line-clamp-2">{b.description}</span>
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          };

          const Masonry = ({ list }: { list: typeof allBreeders }) => (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4 xl:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
              {list.map((b) => (
                <Card key={b.id} b={b} />
              ))}
            </div>
          );

          if (!breedersQ.isLoading && allBreeders.length === 0) {
            return <div className="rounded-xl border border-neutral-200 p-6 text-sm text-neutral-600">暂无数据</div>;
          }

          const activeSeries = (seriesQ.data || []).find((s) => s.id === seriesId) || null;
          const seriesDescription = activeSeries?.description || '';
          const counts = allBreeders.reduce(
            (acc, b) => {
              if (b.sex === 'male') acc.male += 1;
              else if (b.sex === 'female') acc.female += 1;
              else acc.unknown += 1;
              return acc;
            },
            { male: 0, female: 0, unknown: 0 }
          );

          // Show all breeders in a single masonry grid
          return (
            <div>
              <SeriesIntroCard
                seriesId={seriesId}
                seriesName={activeSeries?.name}
                seriesDescription={seriesDescription}
                counts={counts}
                breeders={allBreeders}
              />
              <Masonry list={allBreeders} />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default SeriesFeed;
