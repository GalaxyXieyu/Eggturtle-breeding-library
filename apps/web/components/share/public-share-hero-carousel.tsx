/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export type PublicShareHeroCarouselItem = {
  alt: string;
  id?: string;
  src: string;
};

type PublicShareHeroCarouselProps = {
  items: PublicShareHeroCarouselItem[];
  title: ReactNode;
  subtitle?: ReactNode;
  activeIndex?: number;
  autoPlay?: boolean;
  className?: string;
  contentClassName?: string;
  eyebrow?: ReactNode;
  eyebrowClassName?: string;
  fallbackAlt?: string;
  fallbackSrc?: string;
  footer?: ReactNode;
  heroClassName?: string;
  imageClassName?: string;
  intervalMs?: number;
  onActiveIndexChange?: (index: number) => void;
  overlayColor?: string | null;
  showArrows?: boolean;
  showDots?: boolean;
  subtitleClassName?: string;
  titleClassName?: string;
  topRight?: ReactNode;
};

const DEFAULT_FALLBACK_SRC = '/images/mg_04.jpg';
const DEFAULT_FALLBACK_ALT = '分享封面';

export function PublicShareHeroCarousel({
  items,
  title,
  subtitle,
  activeIndex,
  autoPlay = true,
  className,
  contentClassName,
  eyebrow,
  eyebrowClassName,
  fallbackAlt = DEFAULT_FALLBACK_ALT,
  fallbackSrc = DEFAULT_FALLBACK_SRC,
  footer,
  heroClassName,
  imageClassName,
  intervalMs = 5000,
  onActiveIndexChange,
  overlayColor,
  showArrows = true,
  showDots = true,
  subtitleClassName,
  titleClassName,
  topRight,
}: PublicShareHeroCarouselProps) {
  const resolvedItems = useMemo<PublicShareHeroCarouselItem[]>(() => {
    if (items.length > 0) {
      return items;
    }

    return [
      {
        alt: fallbackAlt,
        id: 'fallback',
        src: fallbackSrc,
      },
    ];
  }, [fallbackAlt, fallbackSrc, items]);

  const isControlled = typeof activeIndex === 'number';
  const [internalIndex, setInternalIndex] = useState(0);
  const resolvedIndex = normalizeIndex(
    isControlled ? activeIndex ?? 0 : internalIndex,
    resolvedItems.length,
  );
  const activeItem = resolvedItems[resolvedIndex] ?? resolvedItems[0];
  const signature = useMemo(
    () => resolvedItems.map((item) => item.id ?? item.src).join('|'),
    [resolvedItems],
  );
  const currentIndexRef = useRef(resolvedIndex);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const setIndex = useCallback(
    (nextIndex: number) => {
      const normalizedIndex = normalizeIndex(nextIndex, resolvedItems.length);
      if (!isControlled) {
        setInternalIndex(normalizedIndex);
      }
      onActiveIndexChange?.(normalizedIndex);
    },
    [isControlled, onActiveIndexChange, resolvedItems.length],
  );

  useEffect(() => {
    currentIndexRef.current = resolvedIndex;
  }, [resolvedIndex]);

  useEffect(() => {
    if (!isControlled) {
      setInternalIndex(0);
    }
  }, [isControlled, signature]);

  useEffect(() => {
    setImageLoaded(false);
    if (imageRef.current?.complete) {
      setImageLoaded(true);
    }
  }, [resolvedIndex, signature]);

  useEffect(() => {
    if (!autoPlay || resolvedItems.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex(currentIndexRef.current + 1);
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoPlay, intervalMs, resolvedItems.length, setIndex]);

  return (
    <div className={cn('relative overflow-hidden bg-neutral-900', className)}>
      <div className={cn('relative h-full w-full', heroClassName)}>
        {!imageLoaded ? (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-500 via-neutral-400 to-neutral-500" />
        ) : null}

        <img
          ref={imageRef}
          key={activeItem.id ?? `${activeItem.src}-${resolvedIndex}`}
          src={activeItem.src}
          alt={activeItem.alt}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
            imageLoaded ? 'opacity-100' : 'opacity-0',
            imageClassName,
          )}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-black/40" />
        {overlayColor ? (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${overlayColor}, transparent 52%)` }}
          />
        ) : null}

        {topRight ? <div className="absolute right-3 top-3 z-20">{topRight}</div> : null}

        {showArrows && resolvedItems.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="上一张"
              className="public-carousel-btn left-3"
              onClick={() => setIndex(resolvedIndex - 1)}
            >
              <ChevronLeft size={18} strokeWidth={2.3} />
            </button>
            <button
              type="button"
              aria-label="下一张"
              className="public-carousel-btn right-3"
              onClick={() => setIndex(resolvedIndex + 1)}
            >
              <ChevronRight size={18} strokeWidth={2.3} />
            </button>
          </>
        ) : null}

        {showDots && resolvedItems.length > 1 ? (
          <div className="public-carousel-dots">
            {resolvedItems.map((item, index) => (
              <button
                key={item.id ?? `${item.src}-${index}`}
                type="button"
                aria-label={`切换到第 ${index + 1} 张`}
                onClick={() => setIndex(index)}
                className={cn('public-carousel-dot', index === resolvedIndex && 'is-active')}
              />
            ))}
          </div>
        ) : null}

        <div className={cn('absolute inset-0 flex flex-col justify-end p-4 sm:p-5', contentClassName)}>
          {eyebrow ? (
            <div className={cn('text-xs uppercase tracking-widest text-white/70', eyebrowClassName)}>
              {eyebrow}
            </div>
          ) : null}
          <h2
            className={cn(
              'mt-2 text-[26px] font-semibold leading-tight text-white drop-shadow-sm sm:text-[30px]',
              titleClassName,
            )}
          >
            {title}
          </h2>
          {subtitle ? (
            <div
              className={cn(
                'mt-2 text-sm leading-relaxed text-white/80 sm:text-base',
                subtitleClassName,
              )}
            >
              {subtitle}
            </div>
          ) : null}
          {footer}
        </div>
      </div>
    </div>
  );
}

function normalizeIndex(value: number, length: number) {
  if (length <= 0) {
    return 0;
  }

  const remainder = value % length;
  return remainder >= 0 ? remainder : remainder + length;
}
