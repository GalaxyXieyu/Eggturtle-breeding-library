'use client';

import { Check } from 'lucide-react';

import {
  PRODUCT_BOOLEAN_TOGGLES,
  type ProductBooleanField
} from '@/components/product-drawer/shared';
import { buildInteractivePillClass } from '@/components/ui/pill';

type ProductStatusValues = Record<ProductBooleanField, boolean>;

type ProductStatusToggleGroupProps = {
  values: ProductStatusValues;
  disabled?: boolean;
  onToggle: (field: ProductBooleanField, nextValue: boolean) => void;
};

export default function ProductStatusToggleGroup({
  values,
  disabled = false,
  onToggle
}: ProductStatusToggleGroupProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-600">状态切换（药丸按钮）</p>
      <div className="flex flex-wrap gap-2">
        {PRODUCT_BOOLEAN_TOGGLES.map((item) => {
          const isActive = values[item.field];

          return (
            <button
              key={`toggle-${item.field}`}
              type="button"
              className={buildInteractivePillClass(isActive, {
                className: 'gap-1.5',
                activeClassName: item.activeClassName,
                idleClassName:
                  'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-800'
              })}
              onClick={() => onToggle(item.field, !isActive)}
              disabled={disabled}
            >
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                  isActive
                    ? 'border-current bg-white/85 text-current'
                    : 'border-neutral-300 bg-neutral-100 text-neutral-400'
                }`}
              >
                {isActive ? <Check size={11} strokeWidth={3} /> : null}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
