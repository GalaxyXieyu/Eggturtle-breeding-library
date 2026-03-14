'use client';

import type { ReactNode } from 'react';

import { resolveAuthenticatedAssetUrl } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

import { PublicShareHeroCarousel } from './public-share-hero-carousel';

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

export function TenantSharePreviewCarouselCard({
  activeIndex,
  children,
  className,
  footer,
  onActiveIndexChange,
  preview,
  topRight,
}: TenantSharePreviewCarouselCardProps) {
  const heroItems = preview.heroImages.map((imageUrl, index) => ({
    alt: `${preview.feedTitle} 轮播图 ${index + 1}`,
    id: `tenant-share-preview-hero-${index}`,
    src: resolveAuthenticatedAssetUrl(imageUrl),
  }));

  return (
    <Card
      className={cn(
        'overflow-hidden rounded-3xl border-neutral-200/90 bg-neutral-900 p-0 shadow-[0_18px_42px_rgba(0,0,0,0.2)]',
        className,
      )}
    >
      <PublicShareHeroCarousel
        items={heroItems}
        activeIndex={activeIndex}
        onActiveIndexChange={onActiveIndexChange}
        className="h-[230px] sm:h-[260px] lg:h-[320px]"
        contentClassName="p-5 lg:p-8"
        eyebrow="public share"
        overlayColor={hexToRgba(preview.brandSecondary, 0.18)}
        subtitle={preview.feedSubtitle}
        subtitleClassName="mt-2 text-sm leading-relaxed text-white/80 lg:text-base"
        title={preview.feedTitle}
        titleClassName="mt-2 text-[26px] font-semibold leading-tight text-white drop-shadow-sm lg:text-[34px]"
        footer={footer}
        topRight={topRight ?? children}
      />
    </Card>
  );
}

function hexToRgba(color: string, alpha: number): string {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return `rgba(31,41,55,${alpha})`;
  }

  const hex =
    normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);

  return `rgba(${red},${green},${blue},${alpha})`;
}

function normalizeHexColor(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return null;
  }

  const validHex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  return validHex.test(normalized) ? normalized : null;
}
