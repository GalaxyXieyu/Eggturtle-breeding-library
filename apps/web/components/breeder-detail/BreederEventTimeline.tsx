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

/** Dot color per event type */
function eventDotClass(eventType: string) {
  switch (eventType) {
    case 'mating':
      return 'border-[#FFD400] shadow-[0_0_0_3px_rgba(255,212,0,0.12)]';
    case 'egg':
      return 'border-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.12)]';
    case 'change_mate':
      return 'border-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,0.12)]';
    default:
      return 'border-neutral-300';
  }
}

/** Card hover tint per event type */
function eventCardHoverClass(eventType: string) {
  switch (eventType) {
    case 'mating':
      return 'hover:border-[#FFD400]/30 hover:bg-[#FFD400]/5';
    case 'egg':
      return 'hover:border-emerald-200 hover:bg-emerald-50/40';
    case 'change_mate':
      return 'hover:border-sky-200 hover:bg-sky-50/40';
    default:
      return 'hover:border-neutral-200';
  }
}

/** Selected card style per event type */
function eventSelectedClass(eventType: string) {
  switch (eventType) {
    case 'mating':
      return 'border-[#FFD400]/60 bg-[#FFD400]/8 shadow-[0_4px_16px_rgba(255,212,0,0.12)]';
    case 'egg':
      return 'border-emerald-300/60 bg-emerald-50/60 shadow-[0_4px_16px_rgba(52,211,153,0.10)]';
    case 'change_mate':
      return 'border-sky-300/60 bg-sky-50/60 shadow-[0_4px_16px_rgba(56,189,248,0.10)]';
    default:
      return 'border-neutral-300/60 bg-neutral-50';
  }
}

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
    if (!selectedEventId) return;
    if (filteredEvents.some((event) => event.id === selectedEventId)) return;
    setSelectedEventId(null);
    setPendingScrollEventId(null);
  }, [filteredEvents, selectedEventId]);

  useEffect(() => {
    if (!pendingScrollEventId || !eventExpanded) return;
    const target = recordRefs.current[pendingScrollEventId];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (!nextEventId) return;
    if (!filteredEvents.some((event) => event.id === nextEventId)) return;
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
          <p className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-6 text-center text-sm text-neutral-500">
            暂无事件记录。
          </p>
        ) : (
          <>
            {/* Filter pills */}
            <div className="flex flex-wrap gap-2">
              {EVENT_FILTER_OPTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setEventFilter(item.key)}
                  className={buildInteractivePillClass(eventFilter === item.key, {
                    activeClassName:
                      'border-neutral-900 bg-neutral-900 text-white',
                    idleClassName:
                      'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300',
                  })}
                >
                  {item.title}
                </button>
              ))}
            </div>

            {/* Horizontal scroll mini-cards (navigation) */}
            <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white p-3 shadow-[0_6px_18px_rgba(0,0,0,0.05)]">
              <div className="flex w-max flex-row items-center gap-2">
                {filteredEvents.map((event) => {
                  const isSelected = event.id === selectedEventId;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => handleEventJump(event.id)}
                      aria-pressed={isSelected}
                      className={`flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/60 focus-visible:ring-offset-2 ${
                        isSelected
                          ? 'border-[#FFD400]/70 bg-[#FFD400]/10 text-neutral-900 ring-1 ring-[#FFD400]/40 shadow-[0_6px_20px_rgba(255,212,0,0.18)]'
                          : 'border-neutral-200/90 bg-white text-neutral-700 hover:-translate-y-0.5 hover:border-[#FFD400]/30 hover:bg-[#FFD400]/5'
                      }`}
                    >
                      <span className="text-sm leading-none">{eventTypeIcon(event.eventType)}</span>
                      <span className="text-[10px] font-semibold leading-tight text-neutral-900">
                        {formatEventShortDate(event.eventDate)}
                      </span>
                      <span className="text-[10px] font-semibold leading-tight text-neutral-500">
                        {eventTypeLabel(event.eventType)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List header */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                记录（{filteredEvents.length} 条）
              </span>
              <button
                type="button"
                onClick={() => setEventExpanded((current) => !current)}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300"
              >
                {eventExpanded ? '收起' : '展开'}
              </button>
            </div>

            {/* Timeline list */}
            {eventExpanded ? (
              filteredEvents.length === 0 ? (
                <p className="py-4 text-sm text-neutral-500">暂无记录</p>
              ) : (
                <div className="space-y-6">
                  {groupedEvents.map((group) => (
                    <div key={group.year}>
                      {/* Year label */}
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                          {group.year}
                        </span>
                        <div className="h-px flex-1 bg-neutral-100" />
                      </div>

                      {/* Items */}
                      <div className="relative pl-5">
                        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-neutral-300/80 via-neutral-200 to-transparent" />
                        <div className="space-y-3">
                          {group.items.map((event) => {
                            const isSelected = event.id === selectedEventId;
                            const note = sanitizeEventNoteForDisplay(event.note);

                            return (
                              <div
                                key={event.id}
                                ref={(node) => { recordRefs.current[event.id] = node; }}
                                className="relative flex items-start gap-3 scroll-mt-24"
                              >
                                {/* Dot */}
                                <div
                                  className={`absolute -left-5 mt-[14px] h-[10px] w-[10px] rounded-full border-2 bg-white ${eventDotClass(event.eventType)}`}
                                />

                                {/* Card */}
                                <div
                                  className={`min-w-0 flex-1 rounded-2xl border px-3 py-2.5 transition ${
                                    isSelected
                                      ? eventSelectedClass(event.eventType)
                                      : `border-neutral-100 bg-neutral-50/60 ${eventCardHoverClass(event.eventType)}`
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <span className="text-sm leading-none">
                                      {eventTypeIcon(event.eventType)}
                                    </span>
                                    <span className="text-sm font-semibold text-neutral-900">
                                      {eventTypeLabel(event.eventType)}
                                    </span>
                                    <span className="text-[11px] text-neutral-400">
                                      {formatEventShortDate(event.eventDate)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm font-medium text-neutral-800">
                                    {eventDetailLabels.get(event.id) ?? buildEventSummary(event)}
                                  </p>
                                  {isSelected ? (
                                    <div className="mt-2 rounded-xl border border-neutral-200/80 bg-white px-3 py-2 text-xs leading-5 text-neutral-600">
                                      <p>录入时间 {formatEventClock(event.createdAt)}</p>
                                      <p className="mt-1 whitespace-pre-wrap">
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
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
