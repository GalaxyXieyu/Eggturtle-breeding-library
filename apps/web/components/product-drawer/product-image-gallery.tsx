'use client';
/* eslint-disable @next/next/no-img-element */

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

export type ProductImageGalleryItem = {
  id: string;
  url: string;
  isMain: boolean;
  previewAlt: string;
  thumbnailAlt: string;
};

type ProductImageGalleryProps = {
  items: ProductImageGalleryItem[];
  currentImageIndex: number;
  disabled?: boolean;
  navigationMode?: 'overlay' | 'none';
  articleClassName?: string;
  viewportClassName?: string;
  mainBadgeLabel?: string;
  mainBadgeClassName?: string;
  indexBadgeClassName?: string;
  thumbnailWrapperClassName?: string;
  thumbnailClassName?: string;
  thumbnailSelectedClassName?: string;
  thumbnailIdleClassName?: string;
  thumbnailMainBadgeLabel?: string;
  thumbnailMainBadgeClassName?: string;
  onSetCurrentImageIndex: (index: number) => void;
};

export default function ProductImageGallery({
  items,
  currentImageIndex,
  disabled = false,
  navigationMode = 'none',
  articleClassName = 'relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100',
  viewportClassName = 'relative aspect-square',
  mainBadgeLabel = '主图',
  mainBadgeClassName = 'rounded-full bg-black/70 px-2.5 py-1 text-xs text-white',
  indexBadgeClassName = 'rounded-full bg-black/55 px-2.5 py-1 text-xs text-white',
  thumbnailWrapperClassName = 'flex gap-2 overflow-x-auto pb-1',
  thumbnailClassName = 'relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-all',
  thumbnailSelectedClassName = 'border-neutral-900',
  thumbnailIdleClassName = 'border-transparent',
  thumbnailMainBadgeLabel = '主图',
  thumbnailMainBadgeClassName = 'absolute left-1 top-1 rounded bg-black/65 px-1 py-0.5 text-[10px] font-medium text-white',
  onSetCurrentImageIndex,
}: ProductImageGalleryProps) {
  const currentImage = items[currentImageIndex] ?? items[0] ?? null;
  const hasMultipleImages = items.length > 1;

  if (!currentImage) {
    return null;
  }

  return (
    <>
      <article className={articleClassName}>
        <div className={viewportClassName}>
          <img
            src={currentImage.url}
            alt={currentImage.previewAlt}
            className="h-full w-full object-cover"
          />

          <div className="absolute left-3 top-3 flex items-center gap-2">
            {currentImage.isMain ? <span className={mainBadgeClassName}>{mainBadgeLabel}</span> : null}
            <span className={indexBadgeClassName}>#{currentImageIndex + 1}</span>
          </div>

          {navigationMode === 'overlay' && hasMultipleImages ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute left-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white/92"
                aria-label="上一张图片"
                onClick={() => onSetCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                disabled={disabled || currentImageIndex === 0}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white/92"
                aria-label="下一张图片"
                onClick={() => onSetCurrentImageIndex(Math.min(items.length - 1, currentImageIndex + 1))}
                disabled={disabled || currentImageIndex === items.length - 1}
              >
                <ChevronRight size={16} />
              </Button>
            </>
          ) : null}
        </div>
      </article>

      {hasMultipleImages ? (
        <div className={thumbnailWrapperClassName}>
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`${thumbnailClassName} ${
                index === currentImageIndex ? thumbnailSelectedClassName : thumbnailIdleClassName
              }`}
              onClick={() => onSetCurrentImageIndex(index)}
              disabled={disabled}
            >
              <img
                src={item.url}
                alt={item.thumbnailAlt}
                className="h-full w-full object-cover"
              />
              {item.isMain ? (
                <span className={thumbnailMainBadgeClassName}>{thumbnailMainBadgeLabel}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
