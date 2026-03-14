'use client';

import type { RelationCodeFieldKey } from '@/components/product-drawer/shared';
import { Input } from '@/components/ui/input';

export type RelationCodeSuggestions = {
  loading: boolean;
  visibleSuggestions: string[];
  isVisibleFor: (field: RelationCodeFieldKey) => boolean;
  onFocus: (field: RelationCodeFieldKey, value: string) => void;
  onBlur: () => void;
  onInputChange: (field: RelationCodeFieldKey, value: string) => void;
  onSelect: (field: RelationCodeFieldKey, value: string) => void;
};

type ProductRelationshipCodeFieldsProps = {
  values: Record<RelationCodeFieldKey, string>;
  disabled?: boolean;
  labels?: Partial<Record<RelationCodeFieldKey, string>>;
  placeholders?: Partial<Record<RelationCodeFieldKey, string>>;
  inputIds?: Partial<Record<RelationCodeFieldKey, string>>;
  onChange: (field: RelationCodeFieldKey, value: string) => void;
  suggestions?: RelationCodeSuggestions;
};

const DEFAULT_LABELS: Record<RelationCodeFieldKey, string> = {
  sireCode: '父本编号',
  damCode: '母本编号',
  mateCode: '配偶编号',
};

const DEFAULT_PLACEHOLDERS: Record<RelationCodeFieldKey, string> = {
  sireCode: '可选',
  damCode: '可选',
  mateCode: '可选',
};

const DEFAULT_IDS: Record<RelationCodeFieldKey, string> = {
  sireCode: 'product-drawer-sire-code',
  damCode: 'product-drawer-dam-code',
  mateCode: 'product-drawer-mate-code',
};

const RELATION_CODE_FIELD_ORDER: RelationCodeFieldKey[] = ['sireCode', 'damCode', 'mateCode'];

export default function ProductRelationshipCodeFields({
  values,
  disabled = false,
  labels,
  placeholders,
  inputIds,
  onChange,
  suggestions,
}: ProductRelationshipCodeFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {RELATION_CODE_FIELD_ORDER.map((field) => {
        const label = labels?.[field] ?? DEFAULT_LABELS[field];
        const placeholder = placeholders?.[field] ?? DEFAULT_PLACEHOLDERS[field];
        const inputId = inputIds?.[field] ?? DEFAULT_IDS[field];
        const hasSuggestions = Boolean(suggestions);

        return (
          <div
            key={field}
            className={`${hasSuggestions ? 'relative ' : ''}grid gap-1.5`}
          >
            <label htmlFor={inputId} className="text-xs font-semibold text-neutral-600">
              {label}
            </label>
            <Input
              id={inputId}
              placeholder={placeholder}
              autoComplete={hasSuggestions ? 'off' : undefined}
              value={values[field]}
              onFocus={
                suggestions
                  ? (event) => suggestions.onFocus(field, event.target.value)
                  : undefined
              }
              onBlur={suggestions ? suggestions.onBlur : undefined}
              onChange={(event) => {
                const nextValue = event.target.value;
                onChange(field, nextValue);
                suggestions?.onInputChange(field, nextValue);
              }}
              disabled={disabled}
            />
            {suggestions && suggestions.isVisibleFor(field) ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 max-h-56 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-xl">
                {suggestions.loading ? (
                  <p className="px-3 py-2 text-xs text-neutral-500">检索中...</p>
                ) : suggestions.visibleSuggestions.length > 0 ? (
                  suggestions.visibleSuggestions.map((item) => (
                    <button
                      key={`relation-dropdown-${field}-${item}`}
                      type="button"
                      className="block w-full border-b border-neutral-100 px-3 py-2 text-left text-sm text-neutral-700 transition last:border-b-0 hover:bg-[#FFF6C2] hover:text-neutral-900"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onChange(field, item);
                        suggestions.onSelect(field, item);
                      }}
                      disabled={disabled}
                    >
                      {item}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-xs text-neutral-500">暂无匹配编号，可继续输入新编号。</p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
