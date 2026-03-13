import { useMemo, useState } from 'react';
import { type ProductMaleMatingHistoryItem } from '@eggturtle/shared';
import { Heart, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
          <Heart size={18} />
          交配记录
        </CardTitle>
        <CardDescription>从当前匹配母龟同步交配记录，方便查看这只公龟最近配过谁。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-6 text-center text-sm text-neutral-500">
            当前匹配母龟暂无与本公相关的交配记录。
          </p>
        ) : (
          <>
            {/* Stats */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FFD400]" />
                已同步 {items.length} 条
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-600">
                关联母龟 {femaleCount}
              </span>
            </div>

            {/* Timeline */}
            <div className="space-y-6">
              {displayGroupedItems.map((group) => (
                <div key={group.year}>
                  {/* Year label */}
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                      {group.year}
                    </span>
                    <div className="h-px flex-1 bg-neutral-100" />
                  </div>

                  {/* Items with timeline line */}
                  <div className="relative pl-5">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-[#FFD400]/60 via-neutral-200 to-transparent" />
                    <div className="space-y-3">
                      {group.items.map((item) => {
                        const note = sanitizeEventNoteForDisplay(item.note);
                        return (
                          <div key={item.id} className="relative flex items-start gap-3">
                            {/* Dot */}
                            <div className="absolute -left-5 mt-[14px] h-[10px] w-[10px] rounded-full border-2 border-[#FFD400] bg-white shadow-[0_0_0_3px_rgba(255,212,0,0.12)]" />

                            {/* Card */}
                            <div className="min-w-0 flex-1 rounded-2xl border border-neutral-100 bg-neutral-50/60 px-3 py-2.5 transition hover:border-[#FFD400]/30 hover:bg-[#FFD400]/5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-neutral-900 leading-snug">
                                    母龟 {buildFemaleLabel(item)}
                                  </p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-400">
                                    <span>{formatEventShortDate(item.eventDate)}</span>
                                    <span>·</span>
                                    <span>录入 {formatEventClock(item.createdAt)}</span>
                                  </div>
                                  {note ? (
                                    <p className="mt-1.5 text-xs text-neutral-500 leading-relaxed">
                                      {note}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openBreederDetail(item.femaleProductId)}
                                  aria-label={`查看母龟 ${item.femaleCode}`}
                                  className="mt-0.5 shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#B8960A] transition hover:text-neutral-900"
                                >
                                  查看
                                  <ArrowRight size={11} strokeWidth={2.5} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMore ? (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex w-full items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white py-2 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={14} />
                    收起
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    展开全部（{items.length} 条）
                  </>
                )}
              </button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
