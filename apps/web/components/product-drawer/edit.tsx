/* eslint-disable @next/next/no-img-element */
'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  deleteProductImageResponseSchema,
  getProductResponseSchema,
  listProductImagesResponseSchema,
  listSeriesResponseSchema,
  reorderProductImagesRequestSchema,
  reorderProductImagesResponseSchema,
  setMainProductImageResponseSchema,
  updateProductRequestSchema,
  uploadProductImageResponseSchema,
  type Product,
  type ProductImage
} from '@eggturtle/shared';
import {
  Loader2,
  X
} from 'lucide-react';

import { apiRequest } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import { uploadSingleFileWithAuth } from '@/lib/upload-client';
import ProductEditImageWorkbench from '@/components/product-drawer/edit-image-workbench';
import { createDemoDrawerImages } from '@/components/product-drawer/image-utils';
import {
  createSeriesIfNeeded,
  formatSeriesDisplayLabel,
  parseOffspringUnitPrice,
  parsePopularityScore,
  toSuggestedSeriesCode,
  type ProductSeriesOption
} from '@/components/product-drawer/shared';
import { Button } from '@/components/ui/button';
import { modalCloseButtonClass } from '@/components/ui/floating-actions';
import { Input } from '@/components/ui/input';
import { buildInteractivePillClass } from '@/components/ui/pill';

type ProductEditFormState = {
  code: string;
  description: string;
  seriesId: string;
  sex: '' | 'male' | 'female';
  offspringUnitPrice: string;
  sireCode: string;
  damCode: string;
  mateCode: string;
  excludeFromBreeding: boolean;
  hasSample: boolean;
  inStock: boolean;
  popularityScore: string;
  isFeatured: boolean;
};

type ProductEditDrawerProps = {
  open: boolean;
  product: Product | null;
  tenantSlug: string;
  isDemoMode: boolean;
  seriesOptions?: ProductSeriesOption[];
  onClose: () => void;
  onSaved: (product: Product) => void;
  onSeriesCreated?: (series: ProductSeriesOption) => void;
};

export default function ProductEditDrawer({
  open,
  product,
  tenantSlug,
  isDemoMode,
  seriesOptions,
  onClose,
  onSaved,
  onSeriesCreated
}: ProductEditDrawerProps) {
  const [form, setForm] = useState<ProductEditFormState>(toProductEditFormState(product));
  const [resolvedSeriesOptions, setResolvedSeriesOptions] = useState<ProductSeriesOption[]>(
    seriesOptions ?? []
  );
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);
  const [newSeriesCode, setNewSeriesCode] = useState('');
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesDescription, setNewSeriesDescription] = useState('');
  const [newSeriesSortOrder, setNewSeriesSortOrder] = useState('');
  const [newSeriesIsActive, setNewSeriesIsActive] = useState(true);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [submittingImages, setSubmittingImages] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageMessage, setImageMessage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(toProductEditFormState(product));
    setIsCreatingSeries(false);
    setNewSeriesCode('');
    setNewSeriesName('');
    setNewSeriesDescription('');
    setNewSeriesSortOrder('');
    setNewSeriesIsActive(true);
    setError(null);
  }, [open, product]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setResolvedSeriesOptions(seriesOptions ?? []);
  }, [open, seriesOptions]);

  useEffect(() => {
    if (!open || !product || isDemoMode) {
      return;
    }

    if ((seriesOptions ?? []).length > 0) {
      return;
    }

    let cancelled = false;
    setLoadingSeries(true);

    void (async () => {
      try {
        const response = await apiRequest('/series?page=1&pageSize=100', {
          responseSchema: listSeriesResponseSchema
        });

        if (!cancelled) {
          setResolvedSeriesOptions(
            response.items.map((item) => ({
              id: item.id,
              code: item.code,
              name: item.name
            }))
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(formatApiError(requestError));
        }
      } finally {
        if (!cancelled) {
          setLoadingSeries(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDemoMode, open, product, seriesOptions]);

  useEffect(() => {
    if (!open || !product) {
      return;
    }

    let cancelled = false;
    setImageError(null);
    setImageMessage(null);
    setCurrentImageIndex(0);

    if (isDemoMode) {
      setLoadingImages(false);
      setImages(createDemoDrawerImages(product.id));
      return;
    }

    setLoadingImages(true);
    void (async () => {
      try {
        const response = await apiRequest(`/products/${product.id}/images`, {
          responseSchema: listProductImagesResponseSchema
        });

        if (!cancelled) {
          setImages(response.images);
        }
      } catch (requestError) {
        if (!cancelled) {
          setImageError(formatApiError(requestError));
        }
      } finally {
        if (!cancelled) {
          setLoadingImages(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDemoMode, open, product]);

  useEffect(() => {
    if (images.length === 0) {
      setCurrentImageIndex(0);
      return;
    }

    if (currentImageIndex > images.length - 1) {
      setCurrentImageIndex(images.length - 1);
    }
  }, [currentImageIndex, images.length]);

  const canShowPrice = useMemo(() => form.sex === 'female', [form.sex]);
  const currentImage = useMemo(
    () => images[currentImageIndex] ?? images[0] ?? null,
    [currentImageIndex, images]
  );
  const hasMultipleImages = images.length > 1;
  const selectedSeriesLabel = useMemo(() => {
    if (!form.seriesId) {
      return '不选择系列';
    }

    const matched = resolvedSeriesOptions.find((item) => item.id === form.seriesId);
    if (matched) {
      return formatSeriesDisplayLabel(matched, { includeCodeForDistinct: true });
    }

    return `当前系列（${form.seriesId}）`;
  }, [form.seriesId, resolvedSeriesOptions]);

  if (!open || !product) {
    return null;
  }

  function closeDrawer() {
    if (submitting || submittingImages) {
      return;
    }

    onClose();
  }

  async function handleSave() {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }

    const normalizedCode = form.code.trim().toUpperCase();
    if (!normalizedCode) {
      setError('编码不能为空。');
      return;
    }

    const parsedPopularityScore = parsePopularityScore(form.popularityScore);
    if (parsedPopularityScore === null) {
      setError('热度分需要是 0-100 的整数。');
      return;
    }

    const parsedOffspringPrice = parseOffspringUnitPrice(form.sex, form.offspringUnitPrice);
    if (parsedOffspringPrice === 'invalid') {
      setError('子代单价格式不正确，请输入非负数字。');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let nextSeriesId = form.seriesId.trim() ? form.seriesId.trim() : null;

      if (isCreatingSeries) {
        const createdSeries = await createSeriesIfNeeded({
          isDemoMode,
          code: newSeriesCode,
          name: newSeriesName,
          description: newSeriesDescription,
          sortOrder: newSeriesSortOrder,
          isActive: newSeriesIsActive
        });

        nextSeriesId = createdSeries.id;
        setResolvedSeriesOptions((current) => {
          if (current.some((item) => item.id === createdSeries.id)) {
            return current;
          }

          return [...current, createdSeries].sort((left, right) =>
            left.code.localeCompare(right.code, 'zh-CN')
          );
        });
        onSeriesCreated?.(createdSeries);
      }

      const payload = updateProductRequestSchema.parse({
        code: normalizedCode,
        description: form.description.trim() ? form.description.trim() : null,
        seriesId: nextSeriesId,
        sex: form.sex ? form.sex : null,
        offspringUnitPrice: parsedOffspringPrice,
        sireCode: form.sireCode.trim() ? form.sireCode.trim().toUpperCase() : null,
        damCode: form.damCode.trim() ? form.damCode.trim().toUpperCase() : null,
        mateCode: form.mateCode.trim() ? form.mateCode.trim().toUpperCase() : null,
        excludeFromBreeding: form.excludeFromBreeding,
        hasSample: form.hasSample,
        inStock: form.inStock,
        popularityScore: parsedPopularityScore,
        isFeatured: form.isFeatured
      });

      if (isDemoMode) {
        const nextProduct = {
          ...currentProduct,
          type: currentProduct.type ?? 'breeder',
          code: normalizedCode,
          description: form.description.trim() ? form.description.trim() : null,
          seriesId: nextSeriesId,
          sex: form.sex ? form.sex : null,
          offspringUnitPrice: parsedOffspringPrice,
          sireCode: form.sireCode.trim() ? form.sireCode.trim().toUpperCase() : null,
          damCode: form.damCode.trim() ? form.damCode.trim().toUpperCase() : null,
          mateCode: form.mateCode.trim() ? form.mateCode.trim().toUpperCase() : null,
          excludeFromBreeding: form.excludeFromBreeding,
          hasSample: form.hasSample,
          inStock: form.inStock,
          popularityScore: parsedPopularityScore,
          isFeatured: form.isFeatured,
          updatedAt: new Date().toISOString()
        } as Product;

        onSaved(nextProduct);
        onClose();
        return;
      }

      const response = await apiRequest(`/products/${currentProduct.id}`, {
        method: 'PUT',
        body: payload,
        requestSchema: updateProductRequestSchema,
        responseSchema: getProductResponseSchema
      });

      onSaved(response.product);
      onClose();
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function reloadImages(productId: string) {
    const response = await apiRequest(`/products/${productId}/images`, {
      responseSchema: listProductImagesResponseSchema
    });
    setImages(response.images);
  }

  async function handleUploadImages(event: ChangeEvent<HTMLInputElement>) {
    const currentProduct = product;
    const fileList = event.target.files;
    if (!currentProduct || !fileList || fileList.length === 0) {
      return;
    }

    setSubmittingImages(true);
    setImageMessage(null);
    setImageError(null);

    if (isDemoMode) {
      setImageMessage('Demo 模式仅展示 UI，不执行真实上传。');
      setSubmittingImages(false);
      event.target.value = '';
      return;
    }

    try {
      const files = Array.from(fileList);
      for (const file of files) {
        await uploadSingleFileWithAuth(
          `/products/${currentProduct.id}/images`,
          file,
          uploadProductImageResponseSchema
        );
      }

      await reloadImages(currentProduct.id);
      setImageMessage(`已上传 ${files.length} 张图片。`);
    } catch (requestError) {
      setImageError(formatApiError(requestError));
    } finally {
      setSubmittingImages(false);
      event.target.value = '';
    }
  }

  async function handleDeleteImage(imageId: string) {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }

    setSubmittingImages(true);
    setImageMessage(null);
    setImageError(null);

    if (isDemoMode) {
      setImages((current) => current.filter((item) => item.id !== imageId));
      setSubmittingImages(false);
      setImageMessage('Demo 模式：已从页面移除图片。');
      return;
    }

    try {
      await apiRequest(`/products/${currentProduct.id}/images/${imageId}`, {
        method: 'DELETE',
        responseSchema: deleteProductImageResponseSchema
      });
      await reloadImages(currentProduct.id);
      setImageMessage('图片已删除。');
    } catch (requestError) {
      setImageError(formatApiError(requestError));
    } finally {
      setSubmittingImages(false);
    }
  }

  async function handleSetMainImage(imageId: string) {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }

    setSubmittingImages(true);
    setImageMessage(null);
    setImageError(null);

    if (isDemoMode) {
      setImages((current) =>
        current.map((item) => ({
          ...item,
          isMain: item.id === imageId
        }))
      );
      setSubmittingImages(false);
      setImageMessage('Demo 模式：主图标记已更新。');
      return;
    }

    try {
      const response = await apiRequest(`/products/${currentProduct.id}/images/${imageId}/main`, {
        method: 'PUT',
        responseSchema: setMainProductImageResponseSchema
      });

      setImages((current) =>
        current.map((item) => {
          if (item.id === response.image.id) {
            return response.image;
          }

          if (item.isMain) {
            return { ...item, isMain: false };
          }

          return item;
        })
      );
      setImageMessage('主图已更新。');
    } catch (requestError) {
      setImageError(formatApiError(requestError));
    } finally {
      setSubmittingImages(false);
    }
  }

  async function handleMoveImage(index: number, direction: -1 | 1) {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) {
      return;
    }

    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);

    setSubmittingImages(true);
    setImageMessage(null);
    setImageError(null);

    if (isDemoMode) {
      setImages(reordered);
      setCurrentImageIndex(nextIndex);
      setSubmittingImages(false);
      setImageMessage('Demo 模式：图片顺序已更新。');
      return;
    }

    try {
      const payload = reorderProductImagesRequestSchema.parse({
        imageIds: reordered.map((item) => item.id)
      });

      const response = await apiRequest(`/products/${currentProduct.id}/images/reorder`, {
        method: 'PUT',
        body: payload,
        requestSchema: reorderProductImagesRequestSchema,
        responseSchema: reorderProductImagesResponseSchema
      });

      setImages(response.images);
      setCurrentImageIndex(nextIndex);
      setImageMessage('图片顺序已更新。');
    } catch (requestError) {
      setImageError(formatApiError(requestError));
    } finally {
      setSubmittingImages(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="编辑产品资料"
      onClick={closeDrawer}
    >
      <section
        className="relative mx-auto flex h-[76svh] w-[min(92vw,48rem)] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl sm:h-[88svh]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex h-9 min-w-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-600">
              {product.code}
            </span>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold text-neutral-900">编辑乌龟资料</p>
              <p className="text-xs text-neutral-500">用户 {tenantSlug}</p>
            </div>
            <button
              type="button"
              className={modalCloseButtonClass}
              onClick={closeDrawer}
              aria-label="关闭抽屉"
              disabled={submitting}
            >
              <X size={17} strokeWidth={2.6} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="edit-drawer-code" className="text-xs font-semibold text-neutral-600">
                  编码
                </label>
                <Input
                  id="edit-drawer-code"
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, code: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-semibold text-neutral-600">系列（药丸点选）</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buildInteractivePillClass(isCreatingSeries)}
                    onClick={() => {
                      setIsCreatingSeries(true);
                      setForm((current) => ({ ...current, seriesId: '' }));
                      setNewSeriesCode((current) => current || 'NEW-SERIES');
                    }}
                    disabled={submitting || loadingSeries}
                  >
                    + 新增系列
                  </button>
                  <button
                    type="button"
                    className={buildInteractivePillClass(!isCreatingSeries && !form.seriesId)}
                    onClick={() => {
                      setIsCreatingSeries(false);
                      setForm((current) => ({ ...current, seriesId: '' }));
                    }}
                    disabled={submitting}
                  >
                    不选择系列
                  </button>
                  {resolvedSeriesOptions.map((item) => {
                    const label = formatSeriesDisplayLabel(item, { includeCodeForDistinct: false });
                    const title = formatSeriesDisplayLabel(item, { includeCodeForDistinct: true });
                    return (
                      <button
                        key={`edit-drawer-series-pill-${item.id}`}
                        type="button"
                        title={title}
                        className={buildInteractivePillClass(
                          !isCreatingSeries && form.seriesId === item.id
                        )}
                        onClick={() => {
                          setIsCreatingSeries(false);
                          setForm((current) => ({ ...current, seriesId: item.id }));
                        }}
                        disabled={submitting}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {loadingSeries ? <p className="text-xs text-neutral-500">正在加载系列...</p> : null}
                <p className="text-xs text-neutral-500">当前选择：{isCreatingSeries ? '新增系列' : selectedSeriesLabel}</p>
                {isCreatingSeries ? (
                  <div className="space-y-3 rounded-2xl border border-[#FFD400]/35 bg-[#FFF9D8] p-3">
                    <p className="text-xs font-semibold text-neutral-700">新系列信息</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        placeholder="系列编码（必填）"
                        value={newSeriesCode}
                        onChange={(event) => setNewSeriesCode(event.target.value.toUpperCase())}
                        disabled={submitting}
                      />
                      <Input
                        placeholder="系列名称（必填）"
                        value={newSeriesName}
                        onChange={(event) => {
                          const value = event.target.value;
                          setNewSeriesName(value);
                          if (!newSeriesCode.trim()) {
                            setNewSeriesCode(toSuggestedSeriesCode(value));
                          }
                        }}
                        disabled={submitting}
                      />
                      <Input
                        type="number"
                        placeholder="排序（可选）"
                        value={newSeriesSortOrder}
                        onChange={(event) => setNewSeriesSortOrder(event.target.value)}
                        disabled={submitting}
                      />
                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={newSeriesIsActive}
                          onChange={(event) => setNewSeriesIsActive(event.target.checked)}
                          disabled={submitting}
                        />
                        启用系列
                      </label>
                    </div>
                    <textarea
                      rows={2}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="系列描述（可选）"
                      value={newSeriesDescription}
                      onChange={(event) => setNewSeriesDescription(event.target.value)}
                      disabled={submitting}
                    />
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600">性别（药丸点选）</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: '' as const, label: '未知' },
                    { value: 'female' as const, label: '母' },
                    { value: 'male' as const, label: '公' }
                  ].map((option) => (
                    <button
                      key={`sex-pill-${option.value || 'unknown'}`}
                      type="button"
                      className={buildInteractivePillClass(form.sex === option.value)}
                      onClick={() => {
                        setForm((current) => ({
                          ...current,
                          sex: option.value,
                          offspringUnitPrice: option.value === 'female' ? current.offspringUnitPrice : ''
                        }));
                      }}
                      disabled={submitting}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {canShowPrice ? (
                <div className="grid gap-1.5">
                  <label htmlFor="edit-drawer-price" className="text-xs font-semibold text-neutral-600">
                    子代单价
                  </label>
                  <Input
                    id="edit-drawer-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.offspringUnitPrice}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        offspringUnitPrice: event.target.value
                      }))
                    }
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
              <div className="grid gap-1.5">
                <label htmlFor="edit-drawer-sire" className="text-xs font-semibold text-neutral-600">
                  父本编号
                </label>
                <Input
                  id="edit-drawer-sire"
                  value={form.sireCode}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sireCode: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="edit-drawer-dam" className="text-xs font-semibold text-neutral-600">
                  母本编号
                </label>
                <Input
                  id="edit-drawer-dam"
                  value={form.damCode}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, damCode: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="edit-drawer-mate" className="text-xs font-semibold text-neutral-600">
                  配偶编号
                </label>
                <Input
                  id="edit-drawer-mate"
                  value={form.mateCode}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, mateCode: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="edit-drawer-popularity" className="text-xs font-semibold text-neutral-600">
                  热度分
                </label>
                <Input
                  id="edit-drawer-popularity"
                  type="number"
                  min={0}
                  max={100}
                  value={form.popularityScore}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      popularityScore: event.target.value
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="edit-drawer-description" className="text-xs font-semibold text-neutral-600">
                描述
              </label>
              <textarea
                id="edit-drawer-description"
                rows={4}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>

            <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
              <p className="text-xs font-semibold text-neutral-600">繁殖状态</p>
              <label className="mt-2 inline-flex cursor-pointer items-start gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={form.excludeFromBreeding}
                  disabled={submitting}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      excludeFromBreeding: event.target.checked
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                />
                <span className="leading-5">
                  不参与繁殖
                  <span className="block text-xs text-neutral-500">
                    备注：已退休或者已死亡的个体需要勾选
                  </span>
                </span>
              </label>
            </section>

            <ProductEditImageWorkbench
              productId={product.id}
              isDemoMode={isDemoMode}
              submittingImages={submittingImages}
              loadingImages={loadingImages}
              images={images}
              currentImage={currentImage}
              currentImageIndex={currentImageIndex}
              hasMultipleImages={hasMultipleImages}
              imageMessage={imageMessage}
              imageError={imageError}
              onUploadImages={handleUploadImages}
              onDeleteImage={handleDeleteImage}
              onSetMainImage={handleSetMainImage}
              onMoveImage={handleMoveImage}
              onSetCurrentImageIndex={setCurrentImageIndex}
            />

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">{error}</p>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="z-20 border-t border-neutral-200 bg-white px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeDrawer}
              disabled={submitting || submittingImages}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={submitting || submittingImages}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  保存中...
                </>
              ) : (
                '保存资料'
              )}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function toProductEditFormState(product: Product | null): ProductEditFormState {
  if (!product) {
    return {
      code: '',
      description: '',
      seriesId: '',
      sex: '',
      offspringUnitPrice: '',
      sireCode: '',
      damCode: '',
      mateCode: '',
      excludeFromBreeding: false,
      hasSample: false,
      inStock: true,
      popularityScore: '0',
      isFeatured: false
    };
  }

  return {
    code: product.code ?? '',
    description: product.description ?? '',
    seriesId: product.seriesId ?? '',
    sex: product.sex === 'male' || product.sex === 'female' ? product.sex : '',
    offspringUnitPrice:
      product.offspringUnitPrice === null || product.offspringUnitPrice === undefined
        ? ''
        : String(product.offspringUnitPrice),
    sireCode: product.sireCode ?? '',
    damCode: product.damCode ?? '',
    mateCode: product.mateCode ?? '',
    excludeFromBreeding: !!product.excludeFromBreeding,
    hasSample: !!product.hasSample,
    inStock: product.inStock ?? true,
    popularityScore: String(product.popularityScore ?? 0),
    isFeatured: !!product.isFeatured
  };
}
