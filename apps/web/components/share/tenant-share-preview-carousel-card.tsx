'use client';

import { useMemo, type ReactNode } from 'react';

import { resolveAuthenticatedAssetUrl } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  DetailCarouselImagePanel,
  DetailCarouselThumbStrip,
} from '@/components/share/product-detail-carousel-shared';

export type TenantSharePreviewCarouselState = {
  brandSecondary: string;
  feedSubtitle: string;
  feedTitle: string;
  heroImages: string[];
};

type TenantSharePreviewCarouselCardProps = {
  activeIndex: number;
  children?: ReactNode;
  className?: string;
  footer?: ReactNode;
  onActiveIndexChange: (index: number) => void;
  preview: TenantSharePreviewCarouselState;
  topRight?: ReactNode;
};

const DEFAULT_PREVIEW_IMAGE = '/images/mg_04.jpg';

export function TenantSharePreviewCarouselCard({
  activeIndex,
  children,
  className,
  footer,
  onActiveIndexChange,
  preview,
  topRight,
}: TenantSharePreviewCarouselCardProps) {
  const items = useMemo(() => {
    const resolvedItems = preview.heroImages.map((imageUrl, index) => ({
      alt: `${preview.feedTitle} 轮播图 ${index + 1}`,
      id: `tenant-share-preview-hero-${index}`,
      src: resolveAuthenticatedAssetUrl(imageUrl),
    }));

    if (resolvedItems.length > 0) {
      return resolvedItems;
    }

    return [
      {
        alt: preview.feedTitle || '分享预览',
        id: 'tenant-share-preview-fallback',
        src: DEFAULT_PREVIEW_IMAGE,
      },
    ];
  }, [preview.feedTitle, preview.heroImages]);
  const resolvedIndex = normalizeIndex(activeIndex, items.length);
  const headerAction = topRight ?? children;

  return (
    <div
      className={cn(
        'public-border-default public-bg-card-alt overflow-hidden border-y shadow-[0_14px_38px_rgba(0,0,0,0.14)] sm:rounded-3xl sm:border dark:shadow-[0_22px_46px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <div className="relative w-full aspect-square bg-[#1a1810] dark:bg-neutral-950/90 sm:aspect-[4/5]">
        <button
          type="button"
          className="public-btn-secondary absolute left-3 top-3 z-10 flex items-center gap-1.5"
          disabled
        >
          返回
        </button>

        {headerAction ? <div className="absolute right-3 top-3 z-10">{headerAction}</div> : null}

        <DetailCarouselImagePanel
          items={items}
          activeIndex={resolvedIndex}
          onActiveIndexChange={onActiveIndexChange}
          bottomLeft={
            <span className="truncate text-base font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              {preview.feedTitle}
            </span>
          }
        />
      </div>

      <DetailCarouselThumbStrip
        items={items}
        activeIndex={resolvedIndex}
        onActiveIndexChange={onActiveIndexChange}
      />

      {footer ? (
        <div className="public-border-default public-bg-card border-t px-3 py-3 sm:px-4">
          {footer}
        </div>
      ) : null}
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
