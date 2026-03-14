'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import ProductBasicInfoSection from '@/components/product-drawer/product-basic-info-section';
import ProductRelationshipCodeFields from '@/components/product-drawer/relationship-code-fields';
import ProductSeriesCreateFields from '@/components/product-drawer/series-create-fields';
import {
  formatSeriesDisplayLabel,
  type ProductSex,
  type RelationCodeFieldKey,
  type ProductSeriesOption,
} from '@/components/product-drawer/shared';

type ProductCreateBasicInfoSectionProps = {
  submitting: boolean;
  code: string;
  selectedSeriesId: string;
  seriesOptions: ProductSeriesOption[];
  isCreatingSeries: boolean;
  sex: ProductSex;
  offspringUnitPrice: string;
  sireCode: string;
  damCode: string;
  mateCode: string;
  description: string;
  newSeriesCode: string;
  newSeriesName: string;
  newSeriesDescription: string;
  newSeriesSortOrder: string;
  newSeriesIsActive: boolean;
  onCodeChange: (value: string) => void;
  onSelectedSeriesIdChange: (value: string) => void;
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

export default function ProductCreateBasicInfoSection({
  submitting,
  code,
  selectedSeriesId,
  seriesOptions,
  isCreatingSeries,
  sex,
  offspringUnitPrice,
  sireCode,
  damCode,
  mateCode,
  description,
  newSeriesCode,
  newSeriesName,
  newSeriesDescription,
  newSeriesSortOrder,
  newSeriesIsActive,
  onCodeChange,
  onSelectedSeriesIdChange,
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
}: ProductCreateBasicInfoSectionProps) {
  const selectedSeries = seriesOptions.find((item) => item.id === selectedSeriesId) ?? null;

  return (
    <ProductBasicInfoSection
      surface="card"
      title="基础资料"
      description="编码、系列、性别与谱系信息。"
      cardClassName="rounded-2xl border-neutral-200"
      topFields={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="create-drawer-code" className="text-xs font-semibold text-neutral-600">
              产品编码（必填）
            </label>
            <Input
              id="create-drawer-code"
              type="text"
              required
              placeholder="例如 HB-108"
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="create-drawer-series" className="text-xs font-semibold text-neutral-600">
              系列
            </label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <NativeSelect
                id="create-drawer-series"
                value={isCreatingSeries ? '__create__' : selectedSeriesId}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (nextValue === '__create__') {
                    onIsCreatingSeriesChange(true);
                    onSelectedSeriesIdChange('');
                    return;
                  }

                  onIsCreatingSeriesChange(false);
                  onSelectedSeriesIdChange(nextValue);
                }}
                disabled={submitting}
              >
                <option value="">不选择系列</option>
                {seriesOptions.map((item) => (
                  <option key={`create-drawer-series-option-${item.id}`} value={item.id}>
                    {formatSeriesDisplayLabel(item, { includeCodeForDistinct: true })}
                  </option>
                ))}
              </NativeSelect>
              <Button
                type="button"
                variant={isCreatingSeries ? 'default' : 'secondary'}
                className="w-full sm:w-auto"
                onClick={() => {
                  onIsCreatingSeriesChange(true);
                  onSelectedSeriesIdChange('');
                }}
                disabled={submitting}
              >
                新建系列
              </Button>
            </div>
            {isCreatingSeries ? (
              <p className="text-xs text-amber-700">将先创建系列，再完成当前乌龟创建。</p>
            ) : selectedSeries ? (
              <p className="text-xs text-emerald-600">
                已选择系列：
                {formatSeriesDisplayLabel(selectedSeries, { includeCodeForDistinct: true })}
              </p>
            ) : (
              <p className="text-xs text-neutral-500">可留空，或先新建系列后直接关联。</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="create-drawer-sex" className="text-xs font-semibold text-neutral-600">
              性别
            </label>
            <NativeSelect
              id="create-drawer-sex"
              value={sex}
              onChange={(event) => onSexChange(event.target.value as ProductSex)}
            >
              <option value="">未知</option>
              <option value="male">公</option>
              <option value="female">母</option>
            </NativeSelect>
          </div>
          {sex === 'female' ? (
            <div className="grid gap-1.5">
              <label htmlFor="create-drawer-price" className="text-xs font-semibold text-neutral-600">
                子代单价
              </label>
              <Input
                id="create-drawer-price"
                type="number"
                min={0}
                step="0.01"
                placeholder="可选，如 18000"
                value={offspringUnitPrice}
                onChange={(event) => onOffspringUnitPriceChange(event.target.value)}
              />
            </div>
          ) : null}
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
          disabled={submitting}
          inputIds={{
            sireCode: 'create-drawer-sire',
            damCode: 'create-drawer-dam',
            mateCode: 'create-drawer-mate',
          }}
          onChange={onRelationCodeChange}
        />
      }
      descriptionField={
        <div className="grid gap-1.5">
          <label htmlFor="create-drawer-description" className="text-xs font-semibold text-neutral-600">
            备注
          </label>
          <textarea
            id="create-drawer-description"
            rows={3}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            placeholder="可选，记录来源/特征等"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </div>
      }
    />
  );
}
