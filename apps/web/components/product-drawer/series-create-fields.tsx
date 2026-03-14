'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ProductSeriesCreateFieldsProps = {
  code: string;
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
  disabled?: boolean;
  title?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  onCodeChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSortOrderChange: (value: string) => void;
  onActiveChange: (nextValue: boolean) => void;
};

export default function ProductSeriesCreateFields({
  code,
  name,
  description,
  sortOrder,
  isActive,
  disabled = false,
  title = '新系列信息',
  cancelLabel = '返回选择',
  onCancel,
  onCodeChange,
  onNameChange,
  onDescriptionChange,
  onSortOrderChange,
  onActiveChange,
}: ProductSeriesCreateFieldsProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-[#FFD400]/35 bg-[#FFF9D8] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-neutral-700">{title}</p>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs text-neutral-600"
            onClick={onCancel}
            disabled={disabled}
          >
            {cancelLabel}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="系列编码（必填）"
          value={code}
          onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
          disabled={disabled}
        />
        <Input
          placeholder="系列名称（必填）"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={disabled}
        />
        <Input
          type="number"
          placeholder="排序（可选）"
          value={sortOrder}
          onChange={(event) => onSortOrderChange(event.target.value)}
          disabled={disabled}
        />
        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => onActiveChange(event.target.checked)}
            disabled={disabled}
          />
          启用系列
        </label>
      </div>
      <textarea
        rows={2}
        className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
        placeholder="系列描述（可选）"
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
