import { useEffect, useRef, useState } from 'react';
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [pendingScrollEventId, setPendingScrollEventId] = useState<string | null>(null);
  const recordRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
    setPendingScrollEventId(null);
  }, [eventExpanded, groupedEvents, pendingScrollEventId]);

  function handleEventJump(eventId: string) {
    setSelectedEventId(eventId);
    setPendingScrollEventId(eventId);
    setEventExpanded(true);
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
                      className={`flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center shadow-sm transition ${
                        isSelected
                          ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-[0_10px_24px_rgba(245,158,11,0.18)]'
                          : 'border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-neutral-300'
                      } dark:border-white/10 dark:bg-neutral-950/40`}
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
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">记录（已加载 {filteredEvents.length} 条）</div>
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
                            const note = event.note?.trim();

                            return (
                              <div
                                key={event.id}
                                ref={(node) => {
                                  recordRefs.current[event.id] = node;
                                }}
                                className="scroll-mt-24 px-4 py-3"
                              >
                                <div
                                  className={`rounded-2xl px-3 py-3 transition ${
                                    isSelected
                                      ? 'border border-amber-200 bg-amber-50/70 shadow-[0_10px_24px_rgba(245,158,11,0.12)]'
                                      : 'border border-transparent'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm leading-none">{eventTypeIcon(event.eventType)}</span>
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
                                    <div className="mt-3 rounded-xl border border-amber-200/70 bg-white/80 px-3 py-2 text-xs leading-5 text-neutral-600">
                                      <p>录入时间 {formatEventClock(event.createdAt)}</p>
                                      <p className="mt-1 whitespace-pre-wrap text-neutral-700">
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
