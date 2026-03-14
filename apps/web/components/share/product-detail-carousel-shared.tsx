'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ProductDetailCarouselItem = {
  alt: string;
  id?: string;
  src: string;
};

type DetailCarouselImagePanelProps = {
  items: ProductDetailCarouselItem[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
  className?: string;
};

type DetailCarouselThumbStripProps = {
  items: ProductDetailCarouselItem[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  className?: string;
};

export function DetailCarouselImagePanel({
  items,
  activeIndex,
  onActiveIndexChange,
  bottomLeft,
  bottomRight,
  className,
}: DetailCarouselImagePanelProps) {
  const activeItem = items[activeIndex] ?? items[0];
  const activeItemSrc = activeItem?.src ?? '';
  const activeItemRef = useRef<HTMLImageElement | null>(null);
  const [activeImageLoaded, setActiveImageLoaded] = useState(false);

  useEffect(() => {
    setActiveImageLoaded(false);
    if (activeItemRef.current?.complete) {
      setActiveImageLoaded(true);
    }
  }, [activeItemSrc]);

  return (
    <div className={cn('relative h-full w-full shrink-0', className)}>
      {!activeImageLoaded ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#2a2218] via-[#1e1a12] to-[#2a2218]" />
      ) : null}

      <img
        ref={activeItemRef}
        src={activeItemSrc}
        alt={activeItem?.alt ?? ''}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          activeImageLoaded ? 'opacity-100' : 'opacity-0',
        )}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        onLoad={() => setActiveImageLoaded(true)}
        onError={() => setActiveImageLoaded(true)}
      />

      {items.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => onActiveIndexChange(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            className="public-carousel-btn left-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={18} strokeWidth={2.3} />
          </button>
          <button
            type="button"
            onClick={() => onActiveIndexChange(Math.min(items.length - 1, activeIndex + 1))}
            disabled={activeIndex === items.length - 1}
            className="public-carousel-btn right-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight size={18} strokeWidth={2.3} />
          </button>
        </>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />

      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">{bottomLeft}</div>
        {bottomRight ?? (
          <span className="shrink-0 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
            {activeIndex + 1}/{items.length}
          </span>
        )}
      </div>
    </div>
  );
}

export function DetailCarouselThumbStrip({
  items,
  activeIndex,
  onActiveIndexChange,
  className,
}: DetailCarouselThumbStripProps) {
  if (items.length <= 1) {
    return null;
  }

  return (
    <div className={cn('public-border-default public-bg-card border-t px-3 py-3 sm:px-4', className)}>
      <div className="public-carousel-thumb-strip">
        {items.map((item, index) => (
          <button
            key={item.id ?? `${item.src}-${index}`}
            type="button"
            className={cn('public-carousel-thumb', index === activeIndex && 'is-active')}
            onClick={() => onActiveIndexChange(index)}
            aria-label={`查看第 ${index + 1} 张图片${index === activeIndex ? '（当前）' : ''}`}
          >
            <div className="public-carousel-thumb-frame">
              <img
                src={item.src}
                alt={item.alt}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
