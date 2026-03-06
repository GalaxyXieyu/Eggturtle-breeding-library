'use client';

import type { MouseEvent as ReactMouseEvent } from 'react';
import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SharePreviewState } from '@/app/app/[tenantSlug]/products/products-page-state';

type ProductsSharePreviewCardProps = {
  sharePreview: SharePreviewState;
  shareHeroImageUrl: string;
  shareHeroIndex: number;
  shareOverlayColor: string;
  shareAccentShadow: string;
  activeFilterCount: number;
  onHeroIndexChange: (index: number) => void;
  onOpenFilter: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenCreate: () => void;
  onOpenShareConfig: () => void;
};

export default function ProductsSharePreviewCard({
  sharePreview,
  shareHeroImageUrl,
  shareHeroIndex,
  shareOverlayColor,
  shareAccentShadow,
  activeFilterCount,
  onHeroIndexChange,
  onOpenFilter,
  onOpenCreate,
  onOpenShareConfig,
}: ProductsSharePreviewCardProps) {
  return (
    <Card className="overflow-hidden rounded-3xl border-neutral-200/90 bg-neutral-900 p-0 shadow-[0_18px_42px_rgba(0,0,0,0.2)]">
      <div className="relative h-[230px] sm:h-[260px]">
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-500"
          style={{ backgroundImage: `url(${shareHeroImageUrl})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/65" />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${shareOverlayColor} 10%, transparent 58%)`,
          }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex rounded-full border border-white/30 bg-black/30 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/90 backdrop-blur-sm">
              分享端同款预览
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="border-white/40 bg-white/15 text-white backdrop-blur hover:bg-white/25 lg:hidden"
              onClick={onOpenShareConfig}
            >
              分享配置
            </Button>
          </div>

          <div className="max-w-3xl text-white">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/75">public share preview</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight drop-shadow-sm sm:text-3xl">
              {sharePreview.feedTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
              {sharePreview.feedSubtitle}
            </p>
          </div>

          {sharePreview.heroImages.length > 1 ? (
            <div className="flex gap-1.5">
              {sharePreview.heroImages.map((_, index) => (
                <button
                  key={`hero-dot-${index}`}
                  type="button"
                  aria-label={`切换第 ${index + 1} 张预览图`}
                  onClick={() => onHeroIndexChange(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === shareHeroIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/55'
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/15 bg-white/92 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700">
          <span className="rounded-full border border-neutral-300 bg-white px-2 py-1">分享配置实时映射</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-2 py-1">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: sharePreview.brandPrimary, boxShadow: shareAccentShadow }}
            />
            主色
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-2 py-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sharePreview.brandSecondary }} />
            辅色
          </span>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <div className="relative" data-products-filter-root="true">
            <Button type="button" variant="secondary" onClick={onOpenFilter}>
              <Search size={14} />
              筛选{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
          </div>
          <Button type="button" onClick={onOpenCreate}>
            <Plus size={14} />
            新建产品
          </Button>
          <Button type="button" variant="secondary" onClick={onOpenShareConfig}>
            分享配置
          </Button>
        </div>
      </div>
    </Card>
  );
}
