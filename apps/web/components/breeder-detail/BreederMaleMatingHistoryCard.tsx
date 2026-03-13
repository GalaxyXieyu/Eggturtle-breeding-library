import { useMemo, useState } from 'react';
import { type ProductMaleMatingHistoryItem } from '@eggturtle/shared';
import { CalendarClock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  formatEventClock,
  formatEventShortDate,
  sanitizeEventNoteForDisplay,
} from '@/lib/breeder-utils';

type BreederMaleMatingHistoryCardProps = {
  items: ProductMaleMatingHistoryItem[];
  openBreederDetail: (breederId: string) => void;
};

type GroupedHistory = {
  year: string;
  items: ProductMaleMatingHistoryItem[];
};

function formatHistoryYear(isoDate: string) {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? '未知年份' : String(date.getFullYear());
}

function buildFemaleLabel(item: ProductMaleMatingHistoryItem) {
  const femaleName = item.femaleName?.trim();
  return femaleName ? `${item.femaleCode} · ${femaleName}` : item.femaleCode;
}

export function BreederMaleMatingHistoryCard({
  items,
  openBreederDetail,
}: BreederMaleMatingHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const INITIAL_DISPLAY_COUNT = 5;

  const femaleCount = useMemo(
    () => new Set(items.map((item) => item.femaleProductId)).size,
    [items],
  );

  // Calculate display items based on expanded state
  const displayItems = useMemo(() => {
    if (isExpanded || items.length <= INITIAL_DISPLAY_COUNT) {
      return items;
    }
    return items.slice(0, INITIAL_DISPLAY_COUNT);
  }, [items, isExpanded]);

  const displayGroupedItems = useMemo<GroupedHistory[]>(() => {
    const groups = new Map<string, ProductMaleMatingHistoryItem[]>();
    for (const item of displayItems) {
      const year = formatHistoryYear(item.eventDate);
      const current = groups.get(year);
      if (current) {
        current.push(item);
      } else {
        groups.set(year, [item]);
      }
    }

    return Array.from(groups.entries()).map(([year, yearItems]) => ({
      year,
      items: yearItems,
    }));
  }, [displayItems]);

  const hasMore = items.length > INITIAL_DISPLAY_COUNT;

  return (
    <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <CalendarClock size={18} />
          交配记录
        </CardTitle>
        <CardDescription>从当前匹配母龟同步交配记录，方便查看这只公龟最近配过谁。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-6 text-center text-sm text-neutral-500 dark:border-white/10 dark:bg-neutral-950/40 dark:text-neutral-400">
            当前匹配母龟暂无与本公相关的交配记录。
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                已同步 {items.length} 条
              </span>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                关联母龟 {femaleCount}
              </span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/75">
              {displayGroupedItems.map((group) => (
                <div key={group.year}>
                  <div className="border-b border-neutral-200/80 px-4 py-2 text-sm font-semibold text-neutral-700 last:border-b-0 dark:border-white/10 dark:text-neutral-300">
                    {group.year}
                  </div>
                  <div className="divide-y dark:divide-white/10">
                    {group.items.map((item) => {
                      const note = sanitizeEventNoteForDisplay(item.note);

                      return (
                        <div key={item.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-neutral-200/70 bg-white/90 px-3 py-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm leading-none">🔞</span>
                                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                  交配
                                </span>
                                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                  {formatEventShortDate(item.eventDate)}
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                母龟 {buildFemaleLabel(item)}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                录入时间 {formatEventClock(item.createdAt)}
                              </p>
                              {note ? (
                                <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-200">
                                  备注：{note}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => openBreederDetail(item.femaleProductId)}
                              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-950/30 dark:text-neutral-200 dark:hover:border-white/20"
                            >
                              查看母龟
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {hasMore ? (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="gap-1"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp size={16} />
                      收起
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      展开全部 ({items.length} 条)
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
