'use client';

import { TenantSharePreviewCarouselCard } from '@/components/share/tenant-share-preview-carousel-card';
import { Button } from '@/components/ui/button';
import type { SharePreviewState } from '@/app/app/[tenantSlug]/products/products-page-state';

type ProductsSharePreviewCardProps = {
  sharePreview: SharePreviewState;
  listStatsLabel: string;
  shareHeroIndex: number;
  onHeroIndexChange: (index: number) => void;
  onOpenShareConfig: () => void;
  showShareConfigEntry?: boolean;
};

export default function ProductsSharePreviewCard({
  sharePreview,
  listStatsLabel,
  shareHeroIndex,
  onHeroIndexChange,
  onOpenShareConfig,
  showShareConfigEntry = false,
}: ProductsSharePreviewCardProps) {
  return (
    <TenantSharePreviewCarouselCard
      activeIndex={shareHeroIndex}
      onActiveIndexChange={onHeroIndexChange}
      preview={sharePreview}
      footer={
        <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] leading-relaxed text-white/82 backdrop-blur-sm sm:text-xs">
          <span className="truncate">{listStatsLabel}</span>
        </div>
      }
      topRight={
        showShareConfigEntry ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="border-white/40 bg-white/15 text-white backdrop-blur hover:bg-white/25"
            onClick={onOpenShareConfig}
          >
            分享配置
          </Button>
        ) : null
      }
    />
  );
}
