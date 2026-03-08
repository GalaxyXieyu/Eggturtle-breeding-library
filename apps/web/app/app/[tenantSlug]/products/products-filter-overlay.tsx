'use client';

import type { CSSProperties } from 'react';

import { buildFilterPillClass } from '@/components/filter-pill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { ProductSeriesOption } from '@/components/product-drawer';
import {
  SEX_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
} from '@/app/app/[tenantSlug]/products/products-page-state';

type ProductsFilterOverlayProps = {
  isOpen: boolean;
  isMobileSheet: boolean;
  placement: 'above' | 'below';
  anchorRect: DOMRect | null;
  searchInput: string;
  sexFilter: string;
  statusFilter: string;
  seriesFilterId: string;
  quickSeriesOptions: ProductSeriesOption[];
  seriesOptions: ProductSeriesOption[];
  hasMoreSeriesOptions: boolean;
  onSearchInputChange: (value: string) => void;
  onSexFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onSeriesFilterChange: (value: string) => void;
  onClose: () => void;
  onReset: () => void;
};

export default function ProductsFilterOverlay({
  isOpen,
  isMobileSheet,
  placement,
  anchorRect,
  searchInput,
  sexFilter,
  statusFilter,
  seriesFilterId,
  quickSeriesOptions,
  seriesOptions,
  hasMoreSeriesOptions,
  onSearchInputChange,
  onSexFilterChange,
  onStatusFilterChange,
  onSeriesFilterChange,
  onClose,
  onReset,
}: ProductsFilterOverlayProps) {
  if (!isOpen) {
    return null;
  }

  const renderSexPills = () => {
    return SEX_FILTER_OPTIONS.map((item) => {
      const selected = sexFilter === item.value;
      return (
        <button
          key={`sex-panel-${item.label}`}
          type="button"
          className={buildFilterPillClass(selected)}
          onClick={() => onSexFilterChange(item.value)}
        >
          {item.label}
        </button>
      );
    });
  };

  const renderStatusPills = () => {
    return STATUS_FILTER_OPTIONS.map((item) => {
      const selected = statusFilter === item.value;
      return (
        <button
          key={`status-panel-${item.label}`}
          type="button"
          className={buildFilterPillClass(selected)}
          onClick={() => onStatusFilterChange(item.value)}
        >
          {item.label}
        </button>
      );
    });
  };

  const renderSeriesPills = () => {
    return (
      <>
        <button
          type="button"
          className={buildFilterPillClass(!seriesFilterId)}
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
              key={`series-panel-${item.id}`}
              type="button"
              title={title}
              className={buildFilterPillClass(selected)}
              onClick={() => onSeriesFilterChange(item.id)}
            >
              <span className="max-w-[9.5rem] truncate">{label}</span>
            </button>
          );
        })}
      </>
    );
  };

  const panelBody = (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <p className="text-xs font-semibold text-neutral-600">关键词</p>
        <Input
          type="text"
          placeholder="按编号 / 名称 / 描述搜索"
          value={searchInput}
          className="h-9"
          onChange={(event) => onSearchInputChange(event.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-neutral-600">性别</p>
        <div className="flex flex-wrap gap-2">{renderSexPills()}</div>
      </div>

      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-neutral-600">状态</p>
        <div className="flex flex-wrap gap-2">{renderStatusPills()}</div>
      </div>

      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-neutral-600">系列</p>
        <div className="flex flex-wrap gap-2">{renderSeriesPills()}</div>
        {hasMoreSeriesOptions ? (
          <NativeSelect
            value={seriesFilterId}
            className="h-9"
            onChange={(event) => onSeriesFilterChange(event.target.value)}
          >
            <option value="">更多系列（全部）</option>
            {seriesOptions.map((item) => {
              const label = item.name?.trim() || item.code;
              const optionText = item.code && item.code !== label ? `${label} · ${item.code}` : label;
              return (
                <option key={`series-option-${item.id}`} value={item.id}>
                  {optionText}
                </option>
              );
            })}
          </NativeSelect>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-2">
        <span className="text-xs text-neutral-500">点选即应用，输入关键词会在 200ms 后同步列表。</span>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onReset}>
            清空
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            完成
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobileSheet) {
    return (
      <div
        className="fixed inset-0 z-[70] flex items-end bg-black/35 p-3 sm:items-center sm:justify-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="筛选宠物"
        onClick={onClose}
      >
        <div
          className="mx-auto w-[min(92vw,38rem)] max-h-[86vh] overflow-y-auto rounded-3xl border border-neutral-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-neutral-900"
          data-products-filter-root="true"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">筛选宠物</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">选择条件后会实时更新列表。</p>
            </div>
          </div>
          {panelBody}
        </div>
      </div>
    );
  }

  const placementClass =
    'fixed left-1/2 z-40 w-[min(96vw,620px)] -translate-x-1/2 max-h-[min(80vh,560px)] overflow-y-auto overscroll-contain rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur';

  const placementStyle: CSSProperties | undefined =
    typeof window === 'undefined'
      ? undefined
      : placement === 'above'
        ? {
            top: 'calc(env(safe-area-inset-top) + 10px)',
          }
        : {
            top: anchorRect ? Math.round(anchorRect.bottom + 8) : 96,
          };

  return (
    <div className={placementClass} style={placementStyle} data-products-filter-root="true" role="dialog">
      {panelBody}
    </div>
  );
}
