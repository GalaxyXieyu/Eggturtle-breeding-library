'use client';

import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { type ProductEvent } from '@eggturtle/shared';

import {
  extractDisplayNote,
  formatEventDateLabel,
  formatEventSummary,
  formatEventTypeLabel,
  isEditableEventType,
  type EventTypeQuickFilter,
} from '@/components/product-drawer/event-shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildInteractivePillClass } from '@/components/ui/pill';

type ProductEventHistorySectionProps = {
  loadingEvents: boolean;
  events: ProductEvent[];
  eventMessage: string | null;
  eventError: string | null;
  eventSectionCollapsed: boolean;
  eventTypeFilter: EventTypeQuickFilter;
  eventKeywordFilter: string;
  submitting: boolean;
  submittingImages: boolean;
  submittingEventAction: boolean;
  onToggleCollapsed: () => void;
  onSetEventTypeFilter: (value: EventTypeQuickFilter) => void;
  onSetEventKeywordFilter: (value: string) => void;
  onStartEditEvent: (eventItem: ProductEvent) => void;
  onDeleteEvent: (eventItem: ProductEvent) => void | Promise<void>;
};

export default function ProductEventHistorySection({
  loadingEvents,
  events,
  eventMessage,
  eventError,
  eventSectionCollapsed,
  eventTypeFilter,
  eventKeywordFilter,
  submitting,
  submittingImages,
  submittingEventAction,
  onToggleCollapsed,
  onSetEventTypeFilter,
  onSetEventKeywordFilter,
  onStartEditEvent,
  onDeleteEvent,
}: ProductEventHistorySectionProps) {
  const filteredEvents = useMemo(() => {
    const keyword = eventKeywordFilter.trim().toLowerCase();
    return events.filter((item) => {
      if (eventTypeFilter !== 'all' && item.eventType !== eventTypeFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = [
        formatEventTypeLabel(item.eventType),
        formatEventDateLabel(item.eventDate),
        formatEventSummary(item),
        extractDisplayNote(item.note),
        item.maleCode ?? '',
        item.oldMateCode ?? '',
        item.newMateCode ?? '',
        item.eggCount === null || item.eggCount === undefined ? '' : String(item.eggCount),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [eventKeywordFilter, eventTypeFilter, events]);

  const eventTypeCounts = useMemo(
    () => ({
      all: events.length,
      mating: events.filter((item) => item.eventType === 'mating').length,
      egg: events.filter((item) => item.eventType === 'egg').length,
      change_mate: events.filter((item) => item.eventType === 'change_mate').length,
    }),
    [events],
  );

  const hasActiveEventFilters = eventTypeFilter !== 'all' || eventKeywordFilter.trim().length > 0;

  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-neutral-600">历史事件（可编辑 / 删除）</p>
          <p className="text-xs text-neutral-500">
            修改会直接联动后台批次/证书快照；删除为高风险操作，请确认后执行。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-500">
            {loadingEvents
              ? '加载中...'
              : hasActiveEventFilters
                ? `${filteredEvents.length}/${events.length} 条`
                : `${events.length} 条`}
          </span>
          <Button
            type="button"
            variant="secondary"
            className="h-7 px-2 text-xs"
            onClick={onToggleCollapsed}
            disabled={submittingEventAction}
          >
            {eventSectionCollapsed ? '展开' : '收起'}
            <ChevronDown
              size={14}
              className={`transition-transform ${eventSectionCollapsed ? '-rotate-90' : 'rotate-0'}`}
            />
          </Button>
        </div>
      </div>

      {eventMessage ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {eventMessage}
        </p>
      ) : null}
      {eventError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {eventError}
        </p>
      ) : null}

      {eventSectionCollapsed ? (
        <div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
          历史事件已折叠，点击“展开”查看。
        </div>
      ) : (
        <>
          <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-2.5">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all' as const, label: '全部', count: eventTypeCounts.all },
                { key: 'mating' as const, label: '交配', count: eventTypeCounts.mating },
                { key: 'egg' as const, label: '产蛋', count: eventTypeCounts.egg },
                { key: 'change_mate' as const, label: '换公', count: eventTypeCounts.change_mate },
              ].map((option) => (
                <button
                  key={`event-filter-${option.key}`}
                  type="button"
                  className={buildInteractivePillClass(eventTypeFilter === option.key)}
                  onClick={() => onSetEventTypeFilter(option.key)}
                  disabled={submittingEventAction}
                >
                  {option.label}（{option.count}）
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={eventKeywordFilter}
                onChange={(event) => onSetEventKeywordFilter(event.target.value)}
                placeholder="快速搜索：日期 / 编码 / 备注"
                disabled={submittingEventAction}
              />
              {eventKeywordFilter.trim() ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-2 text-xs"
                  onClick={() => onSetEventKeywordFilter('')}
                  disabled={submittingEventAction}
                >
                  清空
                </Button>
              ) : null}
            </div>
          </div>

          {loadingEvents ? (
            <div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
              正在加载事件...
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
              当前暂无事件记录。
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
              没有匹配的事件，试试放宽筛选条件。
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((item) => {
                const displayNote = extractDisplayNote(item.note);
                return (
                  <article
                    key={`drawer-event-row-${item.id}`}
                    className="rounded-xl border border-neutral-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-neutral-900">
                          {formatEventTypeLabel(item.eventType)}
                          <span className="ml-2 text-xs font-medium text-neutral-500">
                            {formatEventDateLabel(item.eventDate)}
                          </span>
                        </p>
                        <p className="text-xs text-neutral-600">{formatEventSummary(item)}</p>
                        {displayNote ? (
                          <p className="text-xs text-neutral-500">备注：{displayNote}</p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 px-2 text-xs"
                          disabled={
                            submitting ||
                            submittingImages ||
                            submittingEventAction ||
                            !isEditableEventType(item.eventType)
                          }
                          onClick={() => onStartEditEvent(item)}
                        >
                          编辑
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 border-red-200 bg-red-50 px-2 text-xs text-red-700 hover:bg-red-100"
                          disabled={submitting || submittingImages || submittingEventAction}
                          onClick={() => void onDeleteEvent(item)}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
