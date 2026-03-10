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
  activeFilterCount: number;
  onHeroIndexChange: (index: number) => void;
  onOpenFilter: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenCreate: () => void;
  onOpenShareConfig: () => void;
  showShareConfigEntry?: boolean;
  useLegacySharePreviewStyle?: boolean;
};

export default function ProductsSharePreviewCard({
  sharePreview,
  shareHeroImageUrl,
  shareHeroIndex,
  shareOverlayColor,
  activeFilterCount,
  onHeroIndexChange,
  onOpenFilter,
  onOpenCreate,
  onOpenShareConfig,
  showShareConfigEntry = false,
  useLegacySharePreviewStyle = true,
}: ProductsSharePreviewCardProps) {
  if (!useLegacySharePreviewStyle) {
    return (
      <Card className="rounded-3xl border-neutral-200/90 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Products</p>
            <p className="mt-1 text-base font-semibold text-neutral-900">宠物管理</p>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </Card>
    );
  }

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

        <div className="relative z-10 flex h-full flex-col justify-end p-4 sm:p-5">
          <div className="flex items-end justify-between gap-4">
            <div className="flex-1">
              {sharePreview.heroImages.length > 1 ? (
                <div className="mb-3 flex gap-1.5">
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

              <div className="max-w-3xl text-white">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/75">public share preview</p>
                <h2 className="mt-2 text-2xl font-semibold leading-tight drop-shadow-sm sm:text-3xl">
                  {sharePreview.feedTitle}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
                  {sharePreview.feedSubtitle}
                </p>
              </div>
            </div>

            {showShareConfigEntry ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="border-white/40 bg-white/15 text-white backdrop-blur hover:bg-white/25"
                onClick={onOpenShareConfig}
              >
                分享配置
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
