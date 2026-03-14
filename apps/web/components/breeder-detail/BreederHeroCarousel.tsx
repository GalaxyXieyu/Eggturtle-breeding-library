/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

type BreederHeroCarouselItem = {
  id: string;
  src: string;
  thumbnailSrc?: string;
  alt: string;
};

type BreederHeroCarouselProps = {
  items: BreederHeroCarouselItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  title: string;
  subtitle?: string | null;
  emptyState?: ReactNode;
  variant?: 'card' | 'immersive';
};

export function BreederHeroCarousel({
  items,
  activeId,
  onSelect,
  onBack,
  title,
  subtitle,
  emptyState,
  variant = 'card',
}: BreederHeroCarouselProps) {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const resolvedIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeItem = items[resolvedIndex] ?? null;
  const [activeImageLoaded, setActiveImageLoaded] = useState(false);

  useEffect(() => {
    setActiveImageLoaded(false);
  }, [activeItem?.src]);

  const imageCountLabel = useMemo(() => {
    if (items.length <= 1) {
      return null;
    }

    return `${resolvedIndex + 1}/${items.length}`;
  }, [items.length, resolvedIndex]);

  function showPrev() {
    if (resolvedIndex <= 0) {
      return;
    }

    const prevItem = items[resolvedIndex - 1];
    if (prevItem) {
      onSelect(prevItem.id);
    }
  }

  function showNext() {
    if (resolvedIndex >= items.length - 1) {
      return;
    }

    const nextItem = items[resolvedIndex + 1];
    if (nextItem) {
      onSelect(nextItem.id);
    }
  }

  return (
    <div
      className={
        variant === 'immersive'
          ? 'public-border-default public-bg-card-alt min-w-0 w-full overflow-hidden border-y shadow-[0_14px_38px_rgba(0,0,0,0.14)] sm:rounded-[28px] sm:border dark:shadow-[0_22px_46px_rgba(0,0,0,0.45)]'
          : 'public-border-default public-bg-card-alt min-w-0 w-full overflow-hidden rounded-[28px] border shadow-[0_14px_38px_rgba(0,0,0,0.14)] dark:shadow-[0_22px_46px_rgba(0,0,0,0.45)]'
      }
    >
      <div className="relative aspect-square w-full bg-[#1a1810] dark:bg-neutral-950/90">
        <button
          type="button"
          data-ui="button"
          onClick={onBack}
          className="absolute left-3 top-3 z-20 inline-flex h-9 items-center gap-1 rounded-full border border-white/40 bg-black/55 px-3 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:bg-black/65 hover:text-white"
          aria-label="返回列表"
        >
          <ArrowLeft size={14} />
          返回
        </button>

        {activeItem ? (
          <>
            {!activeImageLoaded ? (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#2a2218] via-[#1e1a12] to-[#2a2218]" />
            ) : null}
            <img
              key={activeItem.id}
              src={activeItem.src}
              alt={activeItem.alt}
              className={`h-full w-full object-cover transition-opacity duration-300 ${activeImageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onLoad={() => setActiveImageLoaded(true)}
              onError={() => setActiveImageLoaded(true)}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-400">
            {emptyState ?? <ImageIcon size={42} />}
          </div>
        )}

        {items.length > 1 ? (
          <>
            <button
              type="button"
              data-ui="button"
              onClick={showPrev}
              disabled={resolvedIndex === 0}
              className="public-carousel-btn left-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="上一张"
            >
              <ChevronLeft size={18} strokeWidth={2.3} />
            </button>
            <button
              type="button"
              data-ui="button"
              onClick={showNext}
              disabled={resolvedIndex === items.length - 1}
              className="public-carousel-btn right-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="下一张"
            >
              <ChevronRight size={18} strokeWidth={2.3} />
            </button>
          </>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{title}</p>
            {subtitle ? <p className="truncate text-xs text-white/82">{subtitle}</p> : null}
          </div>
          {imageCountLabel ? (
            <span className="shrink-0 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
              {imageCountLabel}
            </span>
          ) : null}
        </div>
      </div>

      {items.length > 1 ? (
        <div className="public-border-default public-bg-card min-w-0 border-t px-3 py-3 sm:px-4">
          <div className="public-carousel-thumb-strip">
            {items.map((item, index) => {
              const isActive = item.id === activeItem?.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  data-ui="button"
                  className={`public-carousel-thumb ${isActive ? 'is-active' : ''}`}
                  onClick={() => onSelect(item.id)}
                  aria-label={`查看图片 ${index + 1}${isActive ? '（当前）' : ''}`}
                >
                  <div className="public-carousel-thumb-frame">
                    <img
                      src={item.thumbnailSrc ?? item.src}
                      alt={item.alt}
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
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
