import React from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { turtleAlbumService } from '@/services/turtleAlbumService';
import type { BreederEventItem, BreederEventType } from '@/types/turtleAlbum';
import { formatMmDd, formatYear, parseIsoDate } from '@/utils/dateFormat';

function computeNeedMatingStatus(now: Date, lastEggAt: string | null | undefined, lastMatingAt: string | null | undefined) {
  const egg = parseIsoDate(lastEggAt || null);
  if (!egg) return 'normal' as const;

  const mating = parseIsoDate(lastMatingAt || null);
  if (mating && mating.getTime() >= egg.getTime()) return 'normal' as const;

  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(egg.toDateString()).getTime()) / msPerDay);

  if (days >= 10) return 'warning' as const;
  return 'need_mating' as const;
}

function statusBadge(status: 'normal' | 'need_mating' | 'warning') {
  if (status === 'warning') {
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">警告</span>;
  }
  if (status === 'need_mating') {
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">需交配</span>;
  }
  return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">正常</span>;
}

function eventLabel(e: BreederEventItem): string {
  if (e.eventType === 'mating') return '交配';
  if (e.eventType === 'egg') return '产蛋';
  if (e.eventType === 'change_mate') return '换公';
  return e.eventType;
}

function eventDotClass(type: BreederEventType): string {
  if (type === 'egg') return 'bg-pink-500';
  if (type === 'mating') return 'bg-sky-500';
  return 'bg-neutral-600';
}

function eventIcon(type: BreederEventType): string {
  if (type === 'mating') return '🔞';
  if (type === 'egg') return '🥚';
  return '🔁';
}

function formatNoteForDisplay(note: string | null | undefined, e: BreederEventItem): string | null {
  const n = (note || '').trim();
  if (!n) return null;

  // Hide/clean technical backfill notes for end users.
  if (!n.startsWith('backfill:description')) return n;

  const m = n.match(/(?:^|;\s*)raw=(.*)$/);
  if (!m) return null;

  let raw = (m[1] || '').trim();
  // Drop leading date token.
  raw = raw.replace(/^(?:20\d{2}[\.\/-])?\s*\d{1,2}\s*[\.\/-]\s*\d{1,2}\s*/u, '');
  raw = raw.replace(/^\d{1,2}\s*-\s*\d{1,2}\s*/u, '');

  // Drop leading event word + redundant payload (male code / egg count) since UI already shows it.
  if (e.eventType === 'mating') {
    raw = raw.replace(/^(交配|配对|配)\s*/u, '');
    // Remove common male tokens like XT-D/xt-d公 or single-letter d公.
    raw = raw.replace(/^(?:[A-Za-z\u4e00-\u9fff]{1,8}-[A-Za-z0-9]{1,8})(?:公)?\s*/u, '');
    raw = raw.replace(/^[A-Za-z]\s*公\s*/u, '');
  } else if (e.eventType === 'egg') {
    raw = raw.replace(/^(?:产蛋|下蛋|产卵|下卵|产|下)\s*(?:\d{1,2}\s*(?:个|枚|颗)?\s*(?:蛋|卵)?)?\s*/u, '');
  } else if (e.eventType === 'change_mate') {
    raw = raw.replace(/^换公\s*/u, '');
  }

  raw = raw.trim();
  return raw ? raw : null;
}

type Props = {
  breederId: string;
};

export default function BreederEventTimeline({ breederId }: Props) {
  const [filter, setFilter] = React.useState<BreederEventType | 'all'>('all');

  const lastEggQ = useQuery({
    queryKey: ['turtle-album', 'breeder', breederId, 'events', { type: 'egg', limit: 1 }],
    queryFn: () => turtleAlbumService.getBreederEvents(breederId, { type: 'egg', limit: 1 }),
    enabled: !!breederId,
  });

  const lastMatingQ = useQuery({
    queryKey: ['turtle-album', 'breeder', breederId, 'events', { type: 'mating', limit: 1 }],
    queryFn: () => turtleAlbumService.getBreederEvents(breederId, { type: 'mating', limit: 1 }),
    enabled: !!breederId,
  });

  const timelineQ = useInfiniteQuery({
    queryKey: ['turtle-album', 'breeder', breederId, 'timeline-events', { filter }],
    queryFn: ({ pageParam }) =>
      turtleAlbumService.getBreederEvents(breederId, {
        type: filter,
        limit: 10,
        cursor: typeof pageParam === 'string' ? pageParam : null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage?.hasMore ? lastPage?.nextCursor || null : null),
    enabled: !!breederId,
  });

  const items = React.useMemo(() => {
    const pages = timelineQ.data?.pages || [];
    return pages.flatMap((p) => p.items || []);
  }, [timelineQ.data]);

  const DEFAULT_NODE_COUNT = 12;

  // items is most-recent-first (from API pagination); show a readable subset and render oldest -> newest left-to-right.
  const nodeItems = React.useMemo(() => {
    const recent = items.slice(0, DEFAULT_NODE_COUNT);
    return [...recent].reverse();
  }, [items]);

  const timelineScrollRef = React.useRef<HTMLDivElement | null>(null);

  // When data/filter changes, keep the mini timeline scrolled to the newest (right-most).
  React.useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;

    const raf = window.requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [filter, nodeItems.length]);

  const status = React.useMemo(() => {
    const lastEgg = lastEggQ.data?.items?.[0]?.eventDate || null;
    const lastMating = lastMatingQ.data?.items?.[0]?.eventDate || null;
    return computeNeedMatingStatus(new Date(), lastEgg, lastMating);
  }, [lastEggQ.data, lastMatingQ.data]);

  const rowRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const scrollToEvent = (id: string) => {
    const el = rowRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mt-8 px-3 sm:px-4 lg:px-5 2xl:px-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 7h16M4 12h16M4 17h16"
            />
          </svg>
          <h2 className="text-lg font-semibold text-neutral-900">种龟事件</h2>
          {statusBadge(status)}
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-neutral-600 sm:flex-row sm:items-center sm:gap-2">
          <span>最近产蛋 {formatMmDd(lastEggQ.data?.items?.[0]?.eventDate || null)}</span>
          <span className="hidden text-neutral-300 sm:inline">·</span>
          <span>最近交配 {formatMmDd(lastMatingQ.data?.items?.[0]?.eventDate || null)}</span>
        </div>
      </div>

      {/* Mini horizontal timeline */}
      <div
        ref={timelineScrollRef}
        className="mb-4 overflow-x-auto rounded-2xl border border-black/5 bg-white p-3 shadow-[0_6px_18px_rgba(0,0,0,0.05)]"
      >
        {nodeItems.length === 0 ? (
          <div className="text-sm text-neutral-500">暂无事件</div>
        ) : (
          <div className="flex min-w-max flex-row items-center gap-4">
            {nodeItems.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => scrollToEvent(e.id)}
                className="group flex flex-col items-center gap-1"
                title={`${eventLabel(e)} ${formatMmDd(e.eventDate)}`}
              >
                <span className="text-sm leading-none" aria-hidden>
                  {eventIcon(e.eventType)}
                </span>
                <span className="text-[10px] font-medium leading-tight text-neutral-700 group-hover:text-neutral-900">
                  {formatMmDd(e.eventDate)}
                </span>
                <span className="text-[10px] font-semibold leading-tight text-neutral-600 group-hover:text-neutral-900">
                  {eventLabel(e)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            { k: 'all' as const, t: '全部' },
            { k: 'mating' as const, t: '交配' },
            { k: 'egg' as const, t: '产蛋' },
            { k: 'change_mate' as const, t: '换公' },
          ]
        ).map((it) => (
          <button
            key={it.k}
            type="button"
            onClick={() => setFilter(it.k)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              filter === it.k
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
            }`}
          >
            {it.t}
          </button>
        ))}
      </div>

      {/* Detail list */}
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
        {timelineQ.isLoading ? (
          <div className="p-6 text-sm text-neutral-600">加载中...</div>
        ) : null}
        {timelineQ.isError ? (
          <div className="p-6 text-sm text-red-600">{(timelineQ.error as Error).message}</div>
        ) : null}

        {!timelineQ.isLoading && items.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">暂无记录</div>
        ) : null}

        {items.length > 0 ? (
          <div className="divide-y">
            {(() => {
              let prevYear: string | null = null;
              return items.map((e) => {
                const y = formatYear(e.eventDate);
                const showYear = y && y !== prevYear;
                prevYear = y || prevYear;

                return (
                  <React.Fragment key={e.id}>
                    {showYear ? (
                      <div className="bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-700">{y}</div>
                    ) : null}

                    <div
                      ref={(el) => {
                        rowRefs.current[e.id] = el;
                      }}
                      className="px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm leading-none" aria-hidden>
                              {eventIcon(e.eventType)}
                            </span>
                            <span className="text-sm font-semibold text-neutral-900">{eventLabel(e)}</span>
                            <span className="text-xs font-medium text-neutral-500">{formatMmDd(e.eventDate)}</span>
                          </div>

                          {e.eventType === 'mating' ? (
                            <div className="mt-1 text-sm text-neutral-700">
                              公龟 <span className="font-mono">{(e.maleCode || '').trim() || '-'}</span>
                            </div>
                          ) : null}

                          {e.eventType === 'egg' ? (
                            <div className="mt-1 text-sm text-neutral-700">
                              数量 {typeof e.eggCount === 'number' ? e.eggCount : '-'}
                            </div>
                          ) : null}

                          {e.eventType === 'change_mate' ? (
                            <div className="mt-1 text-sm text-neutral-700">
                              {((e.oldMateCode || '').trim() || '-') + ' → ' + ((e.newMateCode || '').trim() || '-')}
                            </div>
                          ) : null}

                          {(() => {
                            const displayNote = formatNoteForDisplay(e.note, e);
                            return displayNote ? (
                              <div className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{displayNote}</div>
                            ) : null;
                          })()}
                        </div>

                        <div className="shrink-0 text-xs font-medium text-neutral-400">{e.eventDate ? '' : ''}</div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        ) : null}

        {timelineQ.hasNextPage ? (
          <div className="flex items-center justify-center border-t bg-neutral-50 px-4 py-3">
            <button
              type="button"
              onClick={() => timelineQ.fetchNextPage()}
              disabled={timelineQ.isFetchingNextPage}
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {timelineQ.isFetchingNextPage ? '加载中...' : '查看更多'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
