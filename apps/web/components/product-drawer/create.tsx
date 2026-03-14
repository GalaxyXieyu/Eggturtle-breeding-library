/* eslint-disable @next/next/no-img-element */
'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import {
  createProductRequestSchema,
  createProductResponseSchema,
  reorderProductImagesRequestSchema,
  reorderProductImagesResponseSchema,
  setMainProductImageResponseSchema,
  uploadProductImageResponseSchema,
  type Product,
  type ProductImage,
  type ReferralReward,
} from '@eggturtle/shared';
import {
  Loader2,
  X,
} from 'lucide-react';

import { apiRequest } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import { uploadSingleFileWithAuth } from '@/lib/upload-client';
import {
  createSeriesIfNeeded,
  parseOffspringUnitPrice,
  parsePopularityScore,
  type ProductSeriesOption,
  type ProductSex
} from '@/components/product-drawer/shared';
import ProductCreateImageWorkbench from '@/components/product-drawer/create-image-workbench';
import {
  createLocalImageId,
  normalizePendingImages,
  releasePendingImageUrls,
  type PendingImageItem,
} from '@/components/product-drawer/image-utils';
import ProductCreateBasicInfoSection from '@/components/product-drawer/product-create-basic-info-section';
import ProductStatusToggleGroup from '@/components/product-drawer/status-toggle-group';
import { useProductSeriesManagement } from '@/components/product-drawer/use-product-series-management';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { modalCloseButtonClass } from '@/components/ui/floating-actions';
import { Input } from '@/components/ui/input';

export type { ProductSeriesOption } from '@/components/product-drawer/shared';
export type { PendingImageItem } from '@/components/product-drawer/image-utils';

type CreateSex = ProductSex;

export type ProductCreateResult = {
  product: Product;
  imageFailures: number;
  message: string;
  referralReward?: ReferralReward | null;
};

type ProductCreateDrawerProps = {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  isDemoMode: boolean;
  seriesOptions: ProductSeriesOption[];
  onSeriesCreated: (series: ProductSeriesOption) => void;
  onCreated: (result: ProductCreateResult) => Promise<void> | void;
};

const DEFAULT_POPULARITY_SCORE = '0';

export default function ProductCreateDrawer({
  open,
  onClose,
  tenantSlug,
  isDemoMode,
  seriesOptions,
  onSeriesCreated,
  onCreated,
}: ProductCreateDrawerProps) {
  const [submitting, setSubmitting] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImageItem[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const [code, setCode] = useState('');
  const [selectedSeriesId, setSelectedSeriesId] = useState('');
  const [sex, setSex] = useState<CreateSex>('');
  const [offspringUnitPrice, setOffspringUnitPrice] = useState('');
  const [sireCode, setSireCode] = useState('');
  const [damCode, setDamCode] = useState('');
  const [mateCode, setMateCode] = useState('');
  const [description, setDescription] = useState('');
  const [excludeFromBreeding, setExcludeFromBreeding] = useState(false);
  const [hasSample, setHasSample] = useState(false);
  const [inStock, setInStock] = useState(true);
  const [popularityScore, setPopularityScore] = useState(DEFAULT_POPULARITY_SCORE);
  const [isFeatured, setIsFeatured] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const pendingImagesRef = useRef<PendingImageItem[]>([]);
  const {
    seriesOptions: resolvedSeriesOptions,
    isCreatingSeries,
    setIsCreatingSeries,
    newSeriesCode,
    setNewSeriesCode,
    newSeriesName,
    setNewSeriesName,
    newSeriesDescription,
    setNewSeriesDescription,
    newSeriesSortOrder,
    setNewSeriesSortOrder,
    newSeriesIsActive,
    setNewSeriesIsActive,
    resetSeriesDraft,
  } = useProductSeriesManagement({
    open,
    isDemoMode,
    initialOptions: seriesOptions,
  });

  const currentImage = pendingImages[currentImageIndex] ?? null;
  const selectedImageCount = pendingImages.length;

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    return () => {
      releasePendingImageUrls(pendingImagesRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
  }, [open]);

  useEffect(() => {
    if (!isCreatingSeries) {
      return;
    }

    if (newSeriesName.trim() || newSeriesCode.trim()) {
      return;
    }

    const fallbackName = code.trim();
    if (!fallbackName) {
      return;
    }

    setNewSeriesName(fallbackName);
  }, [code, isCreatingSeries, newSeriesCode, newSeriesName, setNewSeriesName]);

  useEffect(() => {
    if (pendingImages.length === 0) {
      setCurrentImageIndex(0);
      return;
    }

    if (currentImageIndex > pendingImages.length - 1) {
      setCurrentImageIndex(pendingImages.length - 1);
    }
  }, [currentImageIndex, pendingImages.length]);

  if (!open) {
    return null;
  }

  function resetFormState() {
    setSubmitting(false);
    setCode('');
    setSelectedSeriesId('');
    setIsCreatingSeries(false);
    setSex('');
    setOffspringUnitPrice('');
    setSireCode('');
    setDamCode('');
    setMateCode('');
    setDescription('');
    setExcludeFromBreeding(false);
    setHasSample(false);
    setInStock(true);
    setPopularityScore(DEFAULT_POPULARITY_SCORE);
    setIsFeatured(false);
    resetSeriesDraft();
    setError(null);
    releasePendingImageUrls(pendingImagesRef.current);
    setPendingImages([]);
    pendingImagesRef.current = [];
    setCurrentImageIndex(0);
  }

  function setCreateRelationCode(field: 'sireCode' | 'damCode' | 'mateCode', value: string) {
    const normalized = value.toUpperCase();

    if (field === 'sireCode') {
      setSireCode(normalized);
      return;
    }

    if (field === 'damCode') {
      setDamCode(normalized);
      return;
    }

    setMateCode(normalized);
  }

  function closeDrawer() {
    if (submitting) {
      return;
    }

    resetFormState();
    onClose();
  }

  function handleAddPendingImages(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList);
    setPendingImages((currentItems) => {
      const hasMain = currentItems.some((item) => item.isMain);

      const nextItems = files.map((file, index) => {
        const shouldBeMain = !hasMain && currentItems.length === 0 && index === 0;
        return {
          id: createLocalImageId(),
          file,
          previewUrl: URL.createObjectURL(file),
          isMain: shouldBeMain,
          localOrder: 0,
        } satisfies PendingImageItem;
      });

      return normalizePendingImages([...currentItems, ...nextItems]);
    });

    event.target.value = '';
  }

  function setMainPendingImage(targetId: string) {
    setPendingImages((currentItems) =>
      normalizePendingImages(
        currentItems.map((item) => ({
          ...item,
          isMain: item.id === targetId,
        })),
      ),
    );
  }

  function removePendingImage(targetId: string) {
    setPendingImages((currentItems) => {
      const removed = currentItems.find((item) => item.id === targetId);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      const nextItems = currentItems.filter((item) => item.id !== targetId);
      if (nextItems.length === 0) {
        return [];
      }

      if (!nextItems.some((item) => item.isMain)) {
        nextItems[0] = { ...nextItems[0], isMain: true };
      }

      return normalizePendingImages(nextItems);
    });
  }

  function movePendingImage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= pendingImages.length) {
      return;
    }

    setPendingImages((currentItems) => {
      const reordered = [...currentItems];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(nextIndex, 0, moved);
      return normalizePendingImages(reordered);
    });

    setCurrentImageIndex(nextIndex);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setError('产品编码不能为空。');
      return;
    }

    const parsedPopularity = parsePopularityScore(popularityScore);
    if (parsedPopularity === null) {
      setError('热度分需要是 0-100 的整数。');
      return;
    }

    const parsedOffspringPrice = parseOffspringUnitPrice(sex, offspringUnitPrice);
    if (parsedOffspringPrice === 'invalid') {
      setError('子代单价格式不正确，请输入非负数字。');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const orderedPendingImages = normalizePendingImages([...pendingImages]);

      let resolvedSeriesId: string | null = selectedSeriesId.trim() || null;

      if (isCreatingSeries) {
        const createdSeries = await createSeriesIfNeeded({
          isDemoMode,
          code: newSeriesCode,
          name: newSeriesName,
          description: newSeriesDescription,
          sortOrder: newSeriesSortOrder,
          isActive: newSeriesIsActive,
        });

        resolvedSeriesId = createdSeries.id;
        onSeriesCreated(createdSeries);
      }

      const createProductPayload = createProductRequestSchema.parse({
        code: normalizedCode,
        description: description.trim() ? description.trim() : null,
        seriesId: resolvedSeriesId,
        sex: sex ? sex : null,
        offspringUnitPrice: parsedOffspringPrice,
        sireCode: sireCode.trim() ? sireCode.trim().toUpperCase() : null,
        damCode: damCode.trim() ? damCode.trim().toUpperCase() : null,
        mateCode: mateCode.trim() ? mateCode.trim().toUpperCase() : null,
        excludeFromBreeding,
        hasSample,
        inStock,
        popularityScore: parsedPopularity,
        isFeatured,
      });

      if (isDemoMode) {
        const now = new Date().toISOString();
        const demoProduct: Product = {
          id: `demo-product-${Date.now()}`,
          tenantId: tenantSlug,
          code: createProductPayload.code,
          type: 'breeder',
          name: createProductPayload.name ?? null,
          description: createProductPayload.description ?? null,
          seriesId: createProductPayload.seriesId ?? null,
          sex: createProductPayload.sex ?? null,
          offspringUnitPrice: createProductPayload.offspringUnitPrice ?? null,
          sireCode: createProductPayload.sireCode ?? null,
          damCode: createProductPayload.damCode ?? null,
          mateCode: createProductPayload.mateCode ?? null,
          excludeFromBreeding,
          hasSample,
          inStock,
          popularityScore: parsedPopularity,
          isFeatured,
          coverImageUrl: null,
          createdAt: now,
          updatedAt: now,
        };

        await onCreated({
          product: demoProduct,
          imageFailures: 0,
          message: `演示模式：已创建产品 ${demoProduct.code}。`,
          referralReward: null,
        });

        resetFormState();
        onClose();
        return;
      }

      const createProductResponse = await apiRequest('/products', {
        method: 'POST',
        body: createProductPayload,
        requestSchema: createProductRequestSchema,
        responseSchema: createProductResponseSchema,
      });

      const uploadOutcome = await uploadPendingImages({
        productId: createProductResponse.product.id,
        orderedPendingImages,
      });

      let successMessage =
        uploadOutcome.imageFailures > 0
          ? `产品 ${createProductResponse.product.code} 创建成功，但有 ${uploadOutcome.imageFailures} 张图片处理失败。`
          : `产品 ${createProductResponse.product.code} 创建成功。`;

      if (createProductResponse.referralReward?.status === 'AWARDED') {
        successMessage += ` 邀请奖励已到账，双方各 +${createProductResponse.referralReward.rewardDaysInvitee} 天。`;
      }

      await onCreated({
        product: createProductResponse.product,
        imageFailures: uploadOutcome.imageFailures,
        message: successMessage,
        referralReward: createProductResponse.referralReward ?? null,
      });

      resetFormState();
      onClose();
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadPendingImages(options: {
    productId: string;
    orderedPendingImages: PendingImageItem[];
  }): Promise<{ imageFailures: number }> {
    const { productId, orderedPendingImages } = options;

    if (orderedPendingImages.length === 0) {
      return { imageFailures: 0 };
    }

    const uploaded: Array<{ localId: string; image: ProductImage }> = [];
    let imageFailures = 0;

    for (const pendingImage of orderedPendingImages) {
      try {
        const uploadResponse = await uploadSingleFileWithAuth(
          `/products/${productId}/images`,
          pendingImage.file,
          uploadProductImageResponseSchema,
        );
        uploaded.push({
          localId: pendingImage.id,
          image: uploadResponse.image,
        });
      } catch {
        imageFailures += 1;
      }
    }

    if (uploaded.length === 0) {
      return { imageFailures };
    }

    const desiredMainLocalId =
      orderedPendingImages.find((item) => item.isMain)?.id ?? orderedPendingImages[0]?.id ?? null;
    if (desiredMainLocalId) {
      const desiredMainUploaded = uploaded.find((item) => item.localId === desiredMainLocalId);
      if (desiredMainUploaded && !desiredMainUploaded.image.isMain) {
        try {
          await apiRequest(`/products/${productId}/images/${desiredMainUploaded.image.id}/main`, {
            method: 'PUT',
            responseSchema: setMainProductImageResponseSchema,
          });
        } catch {
          imageFailures += 1;
        }
      }
    }

    if (uploaded.length > 1) {
      try {
        const reorderPayload = reorderProductImagesRequestSchema.parse({
          imageIds: uploaded.map((item) => item.image.id),
        });

        await apiRequest(`/products/${productId}/images/reorder`, {
          method: 'PUT',
          body: reorderPayload,
          requestSchema: reorderProductImagesRequestSchema,
          responseSchema: reorderProductImagesResponseSchema,
        });
      } catch {
        imageFailures += 1;
      }
    }

    return { imageFailures };
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="新建产品"
      onClick={closeDrawer}
    >
      <section
        className="relative mx-auto flex h-[78svh] w-[min(92vw,48rem)] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl sm:h-[88svh]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex h-9 min-w-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-600">
              {selectedImageCount} 图
            </span>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold text-neutral-900">新建乌龟</p>
              <p className="text-xs text-neutral-500">上传图片后直接确认创建</p>
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

        <form
          id="create-product-drawer-form"
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
          onSubmit={handleCreate}
        >
          <div className="space-y-4 pb-2">
            <ProductCreateImageWorkbench
              submitting={submitting}
              selectedImageCount={selectedImageCount}
              pendingImages={pendingImages}
              currentImageIndex={currentImageIndex}
              currentImage={currentImage}
              onAddPendingImages={handleAddPendingImages}
              onSetMainPendingImage={setMainPendingImage}
              onMovePendingImage={movePendingImage}
              onRemovePendingImage={removePendingImage}
              onSetCurrentImageIndex={setCurrentImageIndex}
            />

            <ProductCreateBasicInfoSection
              submitting={submitting}
              code={code}
              selectedSeriesId={selectedSeriesId}
              seriesOptions={resolvedSeriesOptions}
              isCreatingSeries={isCreatingSeries}
              sex={sex}
              offspringUnitPrice={offspringUnitPrice}
              sireCode={sireCode}
              damCode={damCode}
              mateCode={mateCode}
              description={description}
              newSeriesCode={newSeriesCode}
              newSeriesName={newSeriesName}
              newSeriesDescription={newSeriesDescription}
              newSeriesSortOrder={newSeriesSortOrder}
              newSeriesIsActive={newSeriesIsActive}
              onCodeChange={(value) => setCode(value.toUpperCase())}
              onSelectedSeriesIdChange={setSelectedSeriesId}
              onIsCreatingSeriesChange={setIsCreatingSeries}
              onSexChange={setSex}
              onOffspringUnitPriceChange={setOffspringUnitPrice}
              onRelationCodeChange={setCreateRelationCode}
              onDescriptionChange={setDescription}
              onNewSeriesCodeChange={setNewSeriesCode}
              onNewSeriesNameChange={setNewSeriesName}
              onNewSeriesDescriptionChange={setNewSeriesDescription}
              onNewSeriesSortOrderChange={setNewSeriesSortOrder}
              onNewSeriesIsActiveChange={setNewSeriesIsActive}
            />

            <Card className="rounded-2xl border-neutral-200">
              <CardHeader>
                <CardTitle className="text-lg">业务参数</CardTitle>
                <CardDescription>创建时可一次性配置业务状态。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-1.5 sm:max-w-xs">
                  <label
                    htmlFor="create-drawer-popularity"
                    className="text-xs font-semibold text-neutral-600"
                  >
                    热度分（0-100）
                  </label>
                  <Input
                    id="create-drawer-popularity"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={popularityScore}
                    onChange={(event) => setPopularityScore(event.target.value)}
                  />
                </div>
                <ProductStatusToggleGroup
                  values={{
                    excludeFromBreeding,
                    hasSample,
                    inStock,
                    isFeatured
                  }}
                  disabled={submitting}
                  onToggle={(field, nextValue) => {
                    if (field === 'excludeFromBreeding') {
                      setExcludeFromBreeding(nextValue);
                      return;
                    }

                    if (field === 'hasSample') {
                      setHasSample(nextValue);
                      return;
                    }

                    if (field === 'inStock') {
                      setInStock(nextValue);
                      return;
                    }

                    setIsFeatured(nextValue);
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {error ? (
            <Card className="mt-4 rounded-2xl border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </Card>
          ) : null}
        </form>

        <footer className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeDrawer} disabled={submitting}>
              取消
            </Button>
            <Button form="create-product-drawer-form" type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  创建中...
                </>
              ) : selectedImageCount > 0 ? (
                `确认创建（${selectedImageCount} 张图）`
              ) : (
                '确认创建'
              )}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
