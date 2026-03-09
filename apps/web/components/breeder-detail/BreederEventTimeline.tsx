import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { type ProductEvent } from '@eggturtle/shared';
import { CalendarClock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buildInteractivePillClass } from '@/components/ui/pill';
import {
  eventTypeIcon,
  eventTypeLabel,
  formatEventClock,
  formatEventShortDate,
  buildEventSummary,
  sanitizeEventNoteForDisplay,
} from '@/lib/breeder-utils';

const EVENT_FILTER_OPTIONS = [
  { key: 'all' as const, title: '全部' },
  { key: 'mating' as const, title: '交配' },
  { key: 'egg' as const, title: '产蛋' },
  { key: 'change_mate' as const, title: '换公' },
];

type EventFilterType = 'all' | 'mating' | 'egg' | 'change_mate';

type GroupedEvent = {
  year: string;
  items: ProductEvent[];
};

type BreederEventTimelineProps = {
  events: ProductEvent[];
  eventFilter: EventFilterType;
  setEventFilter: (filter: EventFilterType) => void;
  eventExpanded: boolean;
  setEventExpanded: (expanded: boolean | ((current: boolean) => boolean)) => void;
  filteredEvents: ProductEvent[];
  groupedEvents: GroupedEvent[];
  eventDetailLabels: Map<string, string>;
};

export function BreederEventTimeline({
  events,
  eventFilter,
  setEventFilter,
  eventExpanded,
  setEventExpanded,
  filteredEvents,
  groupedEvents,
  eventDetailLabels,
}: BreederEventTimelineProps) {
  const searchParams = useSearchParams();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [pendingScrollEventId, setPendingScrollEventId] = useState<string | null>(null);
  const recordRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTimers = useRef<Record<string, number | undefined>>({});

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    if (filteredEvents.some((event) => event.id === selectedEventId)) {
      return;
    }

    setSelectedEventId(null);
    setPendingScrollEventId(null);
  }, [filteredEvents, selectedEventId]);

  useEffect(() => {
    if (!pendingScrollEventId || !eventExpanded) {
      return;
    }

    const target = recordRefs.current[pendingScrollEventId];
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // keep highlight a bit longer when navigation lands here (hash/link)
    highlightTimers.current[pendingScrollEventId] = window.setTimeout(() => {
      setSelectedEventId((current) => (current === pendingScrollEventId ? null : current));
    }, 2200);

    setPendingScrollEventId(null);
  }, [eventExpanded, groupedEvents, pendingScrollEventId]);

  useEffect(() => {
    const hash = typeof window === 'undefined' ? '' : window.location.hash;
    const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;

    const fromHash = normalizedHash.startsWith('event-') ? normalizedHash.slice('event-'.length) : '';
    const fromQuery = searchParams.get('event');
    const nextEventId = fromQuery || fromHash;

    if (!nextEventId) {
      return;
    }

    if (!filteredEvents.some((event) => event.id === nextEventId)) {
      return;
    }

    setSelectedEventId(nextEventId);
    setPendingScrollEventId(nextEventId);
    setEventExpanded(true);
  }, [filteredEvents, searchParams, setEventExpanded]);

  function handleEventJump(eventId: string) {
    highlightTimers.current[eventId] = window.setTimeout(() => {
      setSelectedEventId((current) => (current === eventId ? null : current));
    }, 2200);

    setSelectedEventId(eventId);
    setPendingScrollEventId(eventId);
    setEventExpanded(true);

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `#event-${eventId}`);
    }
  }

  return (
    <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <CalendarClock size={18} />
          种龟事件
        </CardTitle>
        <CardDescription>交配、产蛋、换公等记录，与分享页展示一致。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length === 0 ? (
          <p className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-6 text-center text-sm text-neutral-500 dark:border-white/10 dark:bg-neutral-950/40 dark:text-neutral-400">
            暂无事件记录。
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {EVENT_FILTER_OPTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setEventFilter(item.key)}
                  className={buildInteractivePillClass(eventFilter === item.key, {
                    activeClassName:
                      'border-neutral-900 bg-neutral-900 text-white dark:border-white/15 dark:bg-neutral-50 dark:text-neutral-950',
                    idleClassName:
                      'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 dark:border-white/10 dark:bg-neutral-950/30 dark:text-neutral-200 dark:hover:border-white/20',
                  })}
                >
                  {item.title}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white p-3 shadow-[0_6px_18px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-neutral-900/75">
              <div className="flex w-max flex-row items-center gap-2">
                {filteredEvents.map((event) => {
                  const isSelected = event.id === selectedEventId;

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => handleEventJump(event.id)}
                      aria-pressed={isSelected}
                      className={`flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950 ${
                        isSelected
                          ? 'border-amber-500/70 bg-amber-100 text-amber-950 ring-1 ring-amber-300/80 shadow-[0_12px_28px_rgba(245,158,11,0.18)] dark:border-amber-400/70 dark:bg-amber-500/14 dark:text-amber-50 dark:ring-amber-500/30'
                          : 'border-neutral-200/90 bg-white text-neutral-700 hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50/40 dark:border-white/10 dark:bg-neutral-950/40 dark:text-neutral-200'
                      }`}
                    >
                      <span className="text-sm leading-none">{eventTypeIcon(event.eventType)}</span>
                      <span className="text-[10px] font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
                        {formatEventShortDate(event.eventDate)}
                      </span>
                      <span className="text-[10px] font-semibold leading-tight text-neutral-600 dark:text-neutral-300">
                        {eventTypeLabel(event.eventType)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/75">
              <div className="border-b bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-neutral-950/35">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                    记录（已加载 {filteredEvents.length} 条）
                  </div>
                  <button
                    type="button"
                    onClick={() => setEventExpanded((current) => !current)}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 dark:border-white/10 dark:bg-neutral-950/30 dark:text-neutral-200 dark:hover:border-white/20"
                  >
                    {eventExpanded ? '收起' : '展开'}
                  </button>
                </div>
              </div>
              {eventExpanded ? (
                filteredEvents.length === 0 ? (
                  <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">暂无记录</div>
                ) : (
                  <div>
                    {groupedEvents.map((group) => (
                      <div key={group.year}>
                        <div className="border-b border-neutral-200/80 px-4 py-2 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-neutral-300">
                          {group.year}
                        </div>
                        <div className="divide-y dark:divide-white/10">
                          {group.items.map((event) => {
                            const isSelected = event.id === selectedEventId;
                            const note = sanitizeEventNoteForDisplay(event.note);

                            return (
                              <div
                                key={event.id}
                                ref={(node) => {
                                  recordRefs.current[event.id] = node;
                                }}
                                className="scroll-mt-24 px-4 py-3"
                              >
                                <div
                                  className={`relative rounded-2xl px-3 py-3 transition focus-within:ring-2 focus-within:ring-amber-400/40 ${
                                    isSelected
                                      ? 'border border-amber-400/80 bg-amber-50/95 shadow-[0_12px_30px_rgba(245,158,11,0.12)]'
                                      : 'border border-neutral-200/70 bg-white/90 hover:border-amber-200/70 hover:bg-amber-50/30'
                                  }`}
                                >
                                  {isSelected ? (
                                    <span
                                      aria-hidden="true"
                                      className="pointer-events-none absolute inset-y-2 left-2 w-1 rounded-full bg-amber-500/70"
                                    />
                                  ) : null}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm leading-none">
                                      {eventTypeIcon(event.eventType)}
                                    </span>
                                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                      {eventTypeLabel(event.eventType)}
                                    </span>
                                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                      {formatEventShortDate(event.eventDate)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    {eventDetailLabels.get(event.id) ?? buildEventSummary(event)}
                                  </p>
                                  {isSelected ? (
                                    <div className="mt-3 rounded-xl border border-amber-300/80 bg-white px-3 py-2 text-xs leading-5 text-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-amber-500/40 dark:bg-neutral-950/75 dark:text-neutral-200">
                                      <p>录入时间 {formatEventClock(event.createdAt)}</p>
                                      <p className="mt-1 whitespace-pre-wrap text-neutral-700 dark:text-neutral-200">
                                        {note ? `备注：${note}` : '备注：暂无补充说明'}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
