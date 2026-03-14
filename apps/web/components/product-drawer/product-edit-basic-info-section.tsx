'use client';

import { Input } from '@/components/ui/input';
import { buildInteractivePillClass } from '@/components/ui/pill';
import ProductBasicInfoSection from '@/components/product-drawer/product-basic-info-section';
import ProductRelationshipCodeFields, {
  type RelationCodeSuggestions,
} from '@/components/product-drawer/relationship-code-fields';
import ProductSeriesCreateFields from '@/components/product-drawer/series-create-fields';
import {
  formatSeriesDisplayLabel,
  type ProductSex,
  type RelationCodeFieldKey,
  type ProductSeriesOption,
} from '@/components/product-drawer/shared';

type ProductEditBasicInfoSectionProps = {
  submitting: boolean;
  loadingSeries: boolean;
  code: string;
  seriesId: string;
  seriesOptions: ProductSeriesOption[];
  isCreatingSeries: boolean;
  sex: ProductSex;
  offspringUnitPrice: string;
  sireCode: string;
  damCode: string;
  mateCode: string;
  description: string;
  relationSuggestions: RelationCodeSuggestions;
  newSeriesCode: string;
  newSeriesName: string;
  newSeriesDescription: string;
  newSeriesSortOrder: string;
  newSeriesIsActive: boolean;
  onCodeChange: (value: string) => void;
  onSeriesIdChange: (value: string) => void;
  onIsCreatingSeriesChange: (value: boolean) => void;
  onSexChange: (value: ProductSex) => void;
  onOffspringUnitPriceChange: (value: string) => void;
  onRelationCodeChange: (field: RelationCodeFieldKey, value: string) => void;
  onDescriptionChange: (value: string) => void;
  onNewSeriesCodeChange: (value: string) => void;
  onNewSeriesNameChange: (value: string) => void;
  onNewSeriesDescriptionChange: (value: string) => void;
  onNewSeriesSortOrderChange: (value: string) => void;
  onNewSeriesIsActiveChange: (value: boolean) => void;
};

export default function ProductEditBasicInfoSection({
  submitting,
  loadingSeries,
  code,
  seriesId,
  seriesOptions,
  isCreatingSeries,
  sex,
  offspringUnitPrice,
  sireCode,
  damCode,
  mateCode,
  description,
  relationSuggestions,
  newSeriesCode,
  newSeriesName,
  newSeriesDescription,
  newSeriesSortOrder,
  newSeriesIsActive,
  onCodeChange,
  onSeriesIdChange,
  onIsCreatingSeriesChange,
  onSexChange,
  onOffspringUnitPriceChange,
  onRelationCodeChange,
  onDescriptionChange,
  onNewSeriesCodeChange,
  onNewSeriesNameChange,
  onNewSeriesDescriptionChange,
  onNewSeriesSortOrderChange,
  onNewSeriesIsActiveChange,
}: ProductEditBasicInfoSectionProps) {
  const selectedSeriesLabel = !seriesId
    ? '不选择系列'
    : formatSeriesDisplayLabel(
        seriesOptions.find((item) => item.id === seriesId) ?? { id: seriesId, code: seriesId, name: seriesId },
        { includeCodeForDistinct: true },
      );

  return (
    <ProductBasicInfoSection
      topFields={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="edit-drawer-code" className="text-xs font-semibold text-neutral-600">
              编码
            </label>
            <Input
              id="edit-drawer-code"
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-xs font-semibold text-neutral-600">系列（药丸点选）</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buildInteractivePillClass(isCreatingSeries, {
                  activeClassName:
                    'border-[#D7B411] bg-[#FFE680] text-neutral-900 shadow-[0_8px_18px_rgba(215,180,17,0.18)]',
                  idleClassName:
                    'border-neutral-200 bg-[#FFFBE8] text-neutral-700 hover:border-[#E7C94C] hover:bg-[#FFF6C2] hover:text-neutral-900',
                })}
                onClick={() => {
                  onIsCreatingSeriesChange(true);
                  onSeriesIdChange('');
                  onNewSeriesCodeChange(newSeriesCode || 'NEW-SERIES');
                }}
                disabled={submitting || loadingSeries}
              >
                + 新增系列
              </button>
              <button
                type="button"
                className={buildInteractivePillClass(!isCreatingSeries && !seriesId, {
                  activeClassName:
                    'border-[#D7B411] bg-[#FFE680] text-neutral-900 shadow-[0_8px_18px_rgba(215,180,17,0.18)]',
                  idleClassName:
                    'border-neutral-200 bg-[#FFFBE8] text-neutral-700 hover:border-[#E7C94C] hover:bg-[#FFF6C2] hover:text-neutral-900',
                })}
                onClick={() => {
                  onIsCreatingSeriesChange(false);
                  onSeriesIdChange('');
                }}
                disabled={submitting}
              >
                不选择系列
              </button>
              {seriesOptions.map((item) => {
                const label = formatSeriesDisplayLabel(item, { includeCodeForDistinct: false });
                const title = formatSeriesDisplayLabel(item, { includeCodeForDistinct: true });

                return (
                  <button
                    key={`edit-drawer-series-pill-${item.id}`}
                    type="button"
                    title={title}
                    className={buildInteractivePillClass(!isCreatingSeries && seriesId === item.id, {
                      activeClassName:
                        'border-[#D7B411] bg-[#FFE680] text-neutral-900 shadow-[0_8px_18px_rgba(215,180,17,0.18)]',
                      idleClassName:
                        'border-neutral-200 bg-[#FFFBE8] text-neutral-700 hover:border-[#E7C94C] hover:bg-[#FFF6C2] hover:text-neutral-900',
                    })}
                    onClick={() => {
                      onIsCreatingSeriesChange(false);
                      onSeriesIdChange(item.id);
                    }}
                    disabled={submitting}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {loadingSeries ? <p className="text-xs text-neutral-500">正在加载系列...</p> : null}
            <p className="text-xs text-neutral-500">
              当前选择：{isCreatingSeries ? '新增系列' : selectedSeriesLabel}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-600">性别（药丸点选）</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '' as const, label: '未知' },
                { value: 'female' as const, label: '母' },
                { value: 'male' as const, label: '公' },
              ].map((option) => (
                <button
                  key={`sex-pill-${option.value || 'unknown'}`}
                  type="button"
                  className={buildInteractivePillClass(sex === option.value)}
                  onClick={() => onSexChange(option.value)}
                  disabled={submitting}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {sex === 'female' ? (
            <div className="grid gap-1.5">
              <label htmlFor="edit-drawer-price" className="text-xs font-semibold text-neutral-600">
                子代单价
              </label>
              <Input
                id="edit-drawer-price"
                type="number"
                min={0}
                step="0.01"
                value={offspringUnitPrice}
                onChange={(event) => onOffspringUnitPriceChange(event.target.value)}
              />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-neutral-600">子代单价</label>
              <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                仅母龟可设置
              </div>
            </div>
          )}
        </div>
      }
      seriesDraftFields={
        isCreatingSeries ? (
          <ProductSeriesCreateFields
            code={newSeriesCode}
            name={newSeriesName}
            description={newSeriesDescription}
            sortOrder={newSeriesSortOrder}
            isActive={newSeriesIsActive}
            disabled={submitting}
            onCancel={() => onIsCreatingSeriesChange(false)}
            onCodeChange={onNewSeriesCodeChange}
            onNameChange={onNewSeriesNameChange}
            onDescriptionChange={onNewSeriesDescriptionChange}
            onSortOrderChange={onNewSeriesSortOrderChange}
            onActiveChange={onNewSeriesIsActiveChange}
          />
        ) : null
      }
      relationshipFields={
        <ProductRelationshipCodeFields
          values={{ sireCode, damCode, mateCode }}
          placeholders={{
            sireCode: '输入后可联想',
            damCode: '输入后可联想',
            mateCode: '输入后可联想',
          }}
          inputIds={{
            sireCode: 'edit-drawer-sire',
            damCode: 'edit-drawer-dam',
            mateCode: 'edit-drawer-mate',
          }}
          onChange={onRelationCodeChange}
          suggestions={relationSuggestions}
        />
      }
      descriptionField={
        <div className="grid gap-1.5">
          <label htmlFor="edit-drawer-description" className="text-xs font-semibold text-neutral-600">
            描述
          </label>
          <textarea
            id="edit-drawer-description"
            rows={4}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </div>
      }
    />
  );
}
