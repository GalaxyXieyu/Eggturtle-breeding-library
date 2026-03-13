'use client';

import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import type { Product } from '@eggturtle/shared';
import { SquarePen } from 'lucide-react';

import { resolveAuthenticatedAssetUrl, withAuthenticatedImageMaxEdge } from '@/lib/api-client';
import { formatSex } from '@/lib/pet-format';
import { buildFilterPillClass } from '@/components/filter-pill';
import { PetCard } from '@/components/pet';
import type { ProductSeriesOption } from '@/components/product-drawer';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  SEX_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
} from '@/app/app/[tenantSlug]/products/products-page-state';

type ProductsListCardProps = {
  showMobileFilterFab: boolean;
  mobileTopFilterRef: RefObject<HTMLDivElement>;
  activeFilterCount: number;
  searchInput: string;
  sexFilter: string;
  seriesFilterId: string;
  statusFilter: string;
  selectedSeriesLabel: string | null;
  selectedStatusLabel: string | null;
  quickSeriesOptions: ProductSeriesOption[];
  hasMoreSeriesOptions: boolean;
  loading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  visibleItems: Product[];
  total: number;
  loadMoreSentinelRef: RefObject<HTMLDivElement>;
  onOpenFilter: (
    event: ReactMouseEvent<HTMLElement>,
    placement: 'above' | 'below',
    options?: { toggle?: boolean },
  ) => void;
  onSearchInputChange: (value: string) => void;
  onSearchInputCommit: () => void;
  onResetFilters: () => void;
  onClearSearch: () => void;
  onSexFilterChange: (value: string) => void;
  onSeriesFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onOpenEdit: (productId: string) => void;
  onOpenPreviewDetail: (productId: string) => void;
};

export default function ProductsListCard({
  showMobileFilterFab,
  mobileTopFilterRef,
  activeFilterCount,
  searchInput,
  sexFilter,
  seriesFilterId,
  statusFilter,
  selectedSeriesLabel,
  selectedStatusLabel,
  quickSeriesOptions,
  hasMoreSeriesOptions,
  loading,
  hasMore,
  isLoadingMore,
  visibleItems,
  total,
  loadMoreSentinelRef,
  onOpenFilter,
  onSearchInputChange,
  onSearchInputCommit,
  onResetFilters,
  onClearSearch,
  onSexFilterChange,
  onSeriesFilterChange,
  onStatusFilterChange,
  onOpenEdit,
  onOpenPreviewDetail,
}: ProductsListCardProps) {
  const renderSexPills = (keyPrefix: string, className?: string) => {
    return SEX_FILTER_OPTIONS.map((item) => {
      const selected = sexFilter === item.value;
      return (
        <button
          key={`${keyPrefix}-${item.label}`}
          type="button"
          className={buildFilterPillClass(selected, { className })}
          onClick={() => onSexFilterChange(item.value)}
        >
          {item.label}
        </button>
      );
    });
  };

  const renderStatusPills = (keyPrefix: string, className?: string) => {
    return STATUS_FILTER_OPTIONS.map((item) => {
      const selected = statusFilter === item.value;
      return (
        <button
          key={`${keyPrefix}-${item.label}`}
          type="button"
          className={buildFilterPillClass(selected, { className })}
          onClick={() => onStatusFilterChange(item.value)}
        >
          {item.label}
        </button>
      );
    });
  };

  const renderSeriesPills = (
    keyPrefix: string,
    options?: {
      className?: string;
      showMoreButton?: boolean;
      onMoreClick?: (event: ReactMouseEvent<HTMLElement>) => void;
    },
  ) => {
    const className = options?.className;

    return (
      <>
        <button
          type="button"
          className={buildFilterPillClass(!seriesFilterId, { className })}
          onClick={() => onSeriesFilterChange('')}
        >
          全部
        </button>
        {quickSeriesOptions.map((item) => {
          const selected = seriesFilterId === item.id;
          const label = item.name?.trim() || item.code;
          const title = item.code && item.code !== label ? `${label} · ${item.code}` : label;
          return (
            <button
              key={`${keyPrefix}-${item.id}`}
              type="button"
              title={title}
              className={buildFilterPillClass(selected, { className })}
              onClick={() => onSeriesFilterChange(item.id)}
            >
              <span className="max-w-[9.5rem] truncate">{label}</span>
            </button>
          );
        })}
        {options?.showMoreButton && hasMoreSeriesOptions ? (
          <button
            type="button"
            className={buildFilterPillClass(false, {
              className: `${className ?? ''} font-medium`.trim(),
            })}
            onClick={(event) => options.onMoreClick?.(event)}
          >
            更多…
          </button>
        ) : null}
      </>
    );
  };

  return (
    <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
      <CardContent className="space-y-4 px-3 pt-3 pb-3 sm:px-6 sm:pt-4 sm:pb-4">
        {!showMobileFilterFab ? (
          <div
            ref={mobileTopFilterRef}
            className="z-20 bg-white/95 px-3 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 lg:hidden lg:rounded-2xl"
          >
            <div className="grid gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <p className="mt-2 w-10 shrink-0 text-[11px] font-medium text-neutral-500">系列</p>
                <div className="flex min-w-0 max-w-full flex-1 gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {renderSeriesPills('series-top', {
                    className: 'shrink-0',
                    showMoreButton: true,
                    onMoreClick: (event) => onOpenFilter(event, 'below'),
                  })}
                </div>
              </div>

              <div className="flex min-w-0 items-start gap-2">
                <p className="mt-2 w-10 shrink-0 text-[11px] font-medium text-neutral-500">性别</p>
                <div className="flex min-w-0 max-w-full flex-1 gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {renderSexPills('sex-top', 'shrink-0')}
                </div>
              </div>

              <div className="flex min-w-0 items-start gap-2">
                <p className="mt-2 w-10 shrink-0 text-[11px] font-medium text-neutral-500">状态</p>
                <div className="flex min-w-0 max-w-full flex-1 gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {renderStatusPills('status-top', 'shrink-0')}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    type="text"
                    placeholder="按编号 / 名称 / 描述搜索"
                    value={searchInput}
                    className="h-11 rounded-full px-4 text-sm placeholder:text-neutral-400"
                    onChange={(event) => onSearchInputChange(event.target.value)}
                    onBlur={onSearchInputCommit}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onSearchInputCommit();
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-normal text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                  onClick={onResetFilters}
                >
                  清空
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeFilterCount > 0 ? (
          <div className="hidden flex-wrap gap-2 text-xs text-neutral-600 lg:flex">
            {searchInput.trim() ? (
              <button
                type="button"
                className="rounded-full border border-[#FFD400]/40 bg-[#FFF9D8] px-3 py-1.5"
                onClick={onClearSearch}
              >
                关键词：{searchInput.trim()} ×
              </button>
            ) : null}
            {sexFilter ? (
              <button
                type="button"
                className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5"
                onClick={() => onSexFilterChange('')}
              >
                性别：{formatSex(sexFilter)} ×
              </button>
            ) : null}
            {selectedSeriesLabel ? (
              <button
                type="button"
                className="rounded-full border border-[#FFD400]/40 bg-[#FFF9D8] px-3 py-1.5"
                onClick={() => onSeriesFilterChange('')}
              >
                系列：{selectedSeriesLabel} ×
              </button>
            ) : null}
            {selectedStatusLabel ? (
              <button
                type="button"
                className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5"
                onClick={() => onStatusFilterChange('')}
              >
                状态：{selectedStatusLabel} ×
              </button>
            ) : null}
          </div>
        ) : null}

        {loading ? <p className="text-sm text-neutral-600">正在加载宠物预览...</p> : null}
        {!loading && visibleItems.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {hasMore
              ? '当前筛选在已加载数据中暂无命中，正在继续加载更多...'
              : '暂无产品，或当前筛选条件未命中结果。'}
          </p>
        ) : null}

        {!loading && visibleItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4 xl:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
            {visibleItems.map((item, index) => (
              <div key={`preview-${item.id}`} data-product-id={item.id}>
              <PetCard
                variant="tenant"
                code={item.code}
                coverImageUrl={
                  item.coverImageUrl
                    ? withAuthenticatedImageMaxEdge(
                        resolveAuthenticatedAssetUrl(item.coverImageUrl),
                        320,
                      )
                    : null
                }
                coverFallbackImageUrl="/images/mg_01.jpg"
                coverAlt={`${item.code} 封面`}
                imageLoading={index < 3 ? 'eager' : 'lazy'}
                sex={item.sex}
                needMatingStatus={item.needMatingStatus}
                daysSinceEgg={item.daysSinceEgg}
                offspringUnitPrice={item.offspringUnitPrice}
                lastEggAt={item.lastEggAt}
                lastMatingAt={item.lastMatingAt}
                description={item.description}
                sireCode={item.sireCode}
                damCode={item.damCode}
                role="button"
                tabIndex={0}
                aria-label={`查看 ${item.code} 详情`}
                onClick={() => onOpenPreviewDetail(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenPreviewDetail(item.id);
                  }
                }}
                topRightSlot={
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.12)] transition-transform duration-200 hover:scale-105">
                    <button
                      type="button"
                      data-ui="button"
                      className="h-full w-full flex items-center justify-center rounded-full border border-white/70 bg-white/90 p-0 text-neutral-700 backdrop-blur-sm transition-all duration-200 hover:border-[#FFD400]/80 hover:bg-[#FFD400] hover:text-white hover:shadow-[0_4px_16px_rgba(255,212,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:border-white/40 dark:bg-neutral-800/90 dark:text-neutral-200 dark:hover:bg-[#FFD400] dark:hover:text-white [&_svg]:shrink-0"
                      aria-label={`编辑 ${item.code}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenEdit(item.id);
                      }}
                    >
                      <SquarePen size={14} strokeWidth={2.25} />
                    </button>
                  </span>
                }
              />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && isLoadingMore ? (
          <p className="text-center text-sm text-neutral-500">正在加载更多...</p>
        ) : null}
        {!loading && hasMore ? (
          <div ref={loadMoreSentinelRef} className="h-2 w-full" aria-hidden="true" />
        ) : null}
        {!loading && visibleItems.length > 0 && !hasMore ? (
          <p className="text-center text-xs text-neutral-400">已展示全部 {total} 条</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
