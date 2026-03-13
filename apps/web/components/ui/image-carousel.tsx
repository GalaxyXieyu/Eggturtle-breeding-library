/* eslint-disable @next/next/no-img-element */

import { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ImageCarouselItem = {
  id: string;
  src: string;
  alt: string;
  thumbnailSrc?: string;
};

type ImageCarouselProps = {
  items: ImageCarouselItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  className?: string;
  heroClassName?: string;
  thumbnailClassName?: string;
  imageClassName?: string;
  emptyState?: ReactNode;
  heroOverlay?: ReactNode;
};

export function ImageCarousel({
  items,
  activeId,
  onSelect,
  className,
  heroClassName,
  thumbnailClassName,
  imageClassName,
  emptyState,
  heroOverlay,
}: ImageCarouselProps) {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const resolvedIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeItem = items[resolvedIndex] ?? null;

  const handleStep = (direction: -1 | 1) => {
    if (items.length <= 1 || !activeItem) {
      return;
    }

    const nextIndex = (resolvedIndex + direction + items.length) % items.length;
    const nextItem = items[nextIndex];
    if (nextItem) {
      onSelect(nextItem.id);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className={cn(
          'relative aspect-square overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(250,250,249,0.98),rgba(244,244,245,0.92))] shadow-[0_18px_42px_rgba(15,23,42,0.10)] ring-1 ring-black/5',
          heroClassName,
        )}
      >
        {activeItem ? (
          <img
            key={activeItem.id}
            src={activeItem.src}
            alt={activeItem.alt}
            className={cn('h-full w-full object-cover', imageClassName)}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <div className="flex min-h-[280px] items-center justify-center text-neutral-400">
            {emptyState ?? <ImageIcon size={42} />}
          </div>
        )}

        {items.length > 1 ? (
          <>
            <button
              type="button"
              data-ui="button"
              onClick={() => handleStep(-1)}
              className="absolute left-3 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 appearance-none items-center justify-center rounded-full border border-white/45 bg-black/45 text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] outline-none backdrop-blur-sm transition [touch-action:manipulation] hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-[#E5B800]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              aria-label="上一张"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              data-ui="button"
              onClick={() => handleStep(1)}
              className="absolute right-3 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 appearance-none items-center justify-center rounded-full border border-white/45 bg-black/45 text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] outline-none backdrop-blur-sm transition [touch-action:manipulation] hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-[#E5B800]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              aria-label="下一张"
            >
              <ChevronRight size={16} />
            </button>
          </>
        ) : null}

        {heroOverlay}
      </div>

      {items.length > 1 ? (
        <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-full gap-1.5 sm:gap-2.5">
            {items.map((item, index) => {
              const isActive = item.id === activeItem?.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  data-ui="button"
                  onClick={() => onSelect(item.id)}
                  aria-label={`查看图片 ${index + 1}${isActive ? '（当前）' : ''}`}
                  className={cn(
                    'group shrink-0 appearance-none overflow-hidden rounded-[16px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,247,245,0.92))] p-[3px] shadow-[0_10px_20px_rgba(15,23,42,0.08)] outline-none ring-1 ring-black/6 transition-all [touch-action:manipulation] focus-visible:ring-2 focus-visible:ring-[#E5B800]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:rounded-2xl sm:p-1.5',
                    isActive
                      ? 'scale-[0.98] ring-2 ring-[#E5B800] shadow-[0_14px_28px_rgba(229,184,0,0.18)]'
                      : 'hover:-translate-y-0.5 hover:ring-black/10',
                    thumbnailClassName,
                  )}
                >
                  <div className="relative h-[52px] w-[52px] overflow-hidden rounded-[10px] bg-stone-100 sm:h-[78px] sm:w-[78px] sm:rounded-[14px]">
                    <img
                      src={item.thumbnailSrc ?? item.src}
                      alt={item.alt}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
