/* eslint-disable @next/next/no-img-element */
'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  createProductRequestSchema,
  createProductResponseSchema,
  createSeriesRequestSchema,
  createSeriesResponseSchema,
  reorderProductImagesRequestSchema,
  reorderProductImagesResponseSchema,
  setMainProductImageResponseSchema,
  uploadProductImageResponseSchema,
  type Product,
  type ProductImage,
} from '@eggturtle/shared';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  X,
} from 'lucide-react';

import { apiRequest } from '../lib/api-client';
import { formatApiError } from '../lib/error-utils';
import { uploadSingleFileWithAuth } from '../lib/upload-client';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { NativeSelect } from './ui/native-select';

export type ProductSeriesOption = {
  id: string;
  code: string;
  name: string;
};

export type PendingImageItem = {
  id: string;
  file: File;
  previewUrl: string;
  isMain: boolean;
  localOrder: number;
};

export type SeriesResolveResult =
  | {
      type: 'matchedExisting';
      seriesId: string | null;
      matched: ProductSeriesOption | null;
      input: string;
    }
  | {
      type: 'requireNewSeries';
      input: string;
    };

type CreateSex = '' | 'male' | 'female';

type ProductCreateResult = {
  product: Product;
  imageFailures: number;
  message: string;
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
const MODAL_CLOSE_BUTTON_CLASS =
  'inline-flex !h-10 !w-10 !min-h-10 !min-w-10 !shrink-0 !items-center !justify-center !rounded-full !border-0 !p-0 !leading-none bg-neutral-900 text-white shadow-[0_10px_24px_rgba(0,0,0,0.34)] ring-1 ring-black/20 transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200';

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
  const [seriesInput, setSeriesInput] = useState('');
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

  const [newSeriesCode, setNewSeriesCode] = useState('');
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesDescription, setNewSeriesDescription] = useState('');
  const [newSeriesSortOrder, setNewSeriesSortOrder] = useState('');
  const [newSeriesIsActive, setNewSeriesIsActive] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const pendingImagesRef = useRef<PendingImageItem[]>([]);

  const seriesResolveResult = useMemo<SeriesResolveResult>(() => {
    return resolveSeriesInput(seriesInput, seriesOptions);
  }, [seriesInput, seriesOptions]);

  const needsNewSeries = seriesResolveResult.type === 'requireNewSeries';
  const currentImage = pendingImages[currentImageIndex] ?? null;
  const hasMultipleImages = pendingImages.length > 1;
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
    if (!needsNewSeries) {
      return;
    }

    const trimmedInput = seriesResolveResult.input.trim();
    if (!trimmedInput) {
      return;
    }

    if (!newSeriesName.trim()) {
      setNewSeriesName(trimmedInput);
    }

    if (!newSeriesCode.trim()) {
      setNewSeriesCode(toSuggestedSeriesCode(trimmedInput));
    }
  }, [needsNewSeries, newSeriesCode, newSeriesName, seriesResolveResult]);

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
    setSeriesInput('');
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
    setNewSeriesCode('');
    setNewSeriesName('');
    setNewSeriesDescription('');
    setNewSeriesSortOrder('');
    setNewSeriesIsActive(true);
    setError(null);
    releasePendingImageUrls(pendingImagesRef.current);
    setPendingImages([]);
    pendingImagesRef.current = [];
    setCurrentImageIndex(0);
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

    const parsedOffspringPrice = parseOffspringPrice(sex, offspringUnitPrice);
    if (parsedOffspringPrice === 'invalid') {
      setError('子代单价格式不正确，请输入非负数字。');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const orderedPendingImages = normalizePendingImages([...pendingImages]);
      const seriesResolution = resolveSeriesInput(seriesInput, seriesOptions);

      let resolvedSeriesId: string | null = null;

      if (seriesResolution.type === 'matchedExisting') {
        resolvedSeriesId = seriesResolution.seriesId;
      } else {
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

      const successMessage =
        uploadOutcome.imageFailures > 0
          ? `产品 ${createProductResponse.product.code} 创建成功，但有 ${uploadOutcome.imageFailures} 张图片处理失败。`
          : `产品 ${createProductResponse.product.code} 创建成功。`;

      await onCreated({
        product: createProductResponse.product,
        imageFailures: uploadOutcome.imageFailures,
        message: successMessage,
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
      return { imageFailures: imageFailures + orderedPendingImages.length };
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
      className="fixed inset-0 z-50 flex items-end bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label="新建产品"
      onClick={closeDrawer}
    >
      <section
        className="relative flex h-[100svh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:mx-auto sm:h-[96svh] sm:max-w-3xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className={MODAL_CLOSE_BUTTON_CLASS}
              onClick={closeDrawer}
              aria-label="关闭抽屉"
              disabled={submitting}
            >
              <X size={17} strokeWidth={2.6} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-neutral-900">新建乌龟</p>
              <p className="text-xs text-neutral-500">上传图片后直接确认创建</p>
            </div>
            <span className="inline-flex h-9 min-w-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-600">
              {selectedImageCount} 图
            </span>
          </div>
        </header>

        <form
          id="create-product-drawer-form"
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
          onSubmit={handleCreate}
        >
          <div className="space-y-4 pb-2">
            <Card className="rounded-2xl border-neutral-200 shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ImagePlus size={16} />
                  上传图片
                </CardTitle>
                <CardDescription>支持多图上传，支持预览、设主图、上下排序。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <label
                  htmlFor="create-drawer-upload-images"
                  className={`block rounded-xl border border-dashed px-4 py-5 transition ${
                    submitting
                      ? 'cursor-not-allowed border-neutral-200 bg-neutral-100'
                      : 'cursor-pointer border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-white'
                  }`}
                >
                  <input
                    id="create-drawer-upload-images"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleAddPendingImages}
                    disabled={submitting}
                    className="sr-only"
                  />
                  <span className="inline-flex rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                    {selectedImageCount > 0 ? '继续添加图片' : '选择图片'}
                  </span>
                  <p className="mt-3 text-sm font-medium text-neutral-800">
                    {selectedImageCount > 0
                      ? `已选择 ${selectedImageCount} 张图片，可继续追加上传`
                      : '点击这里选择图片文件（支持多选）'}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    推荐先上传 1-3 张主视角图，后续可随时补图。
                  </p>
                </label>
                {selectedImageCount === 0 ? (
                  <p className="text-xs text-neutral-500">
                    也可不上传图片，直接填写下方资料并创建。
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500">
                    第一张会默认设为主图，可在下方预览区调整。
                  </p>
                )}
              </CardContent>
            </Card>

            {currentImage ? (
              <Card className="rounded-2xl border-neutral-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">图片预览</CardTitle>
                  <CardDescription>
                    当前第 {currentImageIndex + 1}/{pendingImages.length} 张
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <article className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                    <div className="relative aspect-[4/3] sm:aspect-video">
                      <img
                        src={currentImage.previewUrl}
                        alt={`待上传图片 ${currentImageIndex + 1}`}
                        className="h-full w-full object-cover"
                      />

                      <div className="absolute left-3 top-3 flex items-center gap-2">
                        {currentImage.isMain ? (
                          <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs text-white">
                            主图
                          </span>
                        ) : null}
                        <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">
                          #{currentImageIndex + 1}
                        </span>
                      </div>

                      {hasMultipleImages ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="absolute left-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white/92"
                            aria-label="上一张图片"
                            onClick={() => {
                              setCurrentImageIndex((current) => Math.max(0, current - 1));
                            }}
                            disabled={currentImageIndex === 0 || submitting}
                          >
                            <ChevronLeft size={16} />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="absolute right-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white/92"
                            aria-label="下一张图片"
                            onClick={() => {
                              setCurrentImageIndex((current) =>
                                Math.min(pendingImages.length - 1, current + 1),
                              );
                            }}
                            disabled={currentImageIndex === pendingImages.length - 1 || submitting}
                          >
                            <ChevronRight size={16} />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </article>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setMainPendingImage(currentImage.id)}
                      disabled={submitting || currentImage.isMain}
                    >
                      <Star size={14} />
                      设为主图
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => movePendingImage(currentImageIndex, -1)}
                      disabled={submitting || currentImageIndex === 0}
                    >
                      <ArrowUp size={14} />
                      上移
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => movePendingImage(currentImageIndex, 1)}
                      disabled={submitting || currentImageIndex === pendingImages.length - 1}
                    >
                      <ArrowDown size={14} />
                      下移
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="text-red-600"
                      onClick={() => removePendingImage(currentImage.id)}
                      disabled={submitting}
                    >
                      <Trash2 size={14} />
                      删除
                    </Button>
                  </div>

                  {hasMultipleImages ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {pendingImages.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                            index === currentImageIndex
                              ? 'border-neutral-900'
                              : 'border-transparent'
                          }`}
                          onClick={() => setCurrentImageIndex(index)}
                        >
                          <img
                            src={item.previewUrl}
                            alt={`待上传缩略图 ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          {item.isMain ? (
                            <span className="absolute left-1 top-1 rounded bg-black/65 px-1 py-0.5 text-[10px] font-medium text-white">
                              主图
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card className="rounded-2xl border-neutral-200">
              <CardHeader>
                <CardTitle className="text-lg">基础资料</CardTitle>
                <CardDescription>编码、系列、性别与谱系信息。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <label
                      htmlFor="create-drawer-code"
                      className="text-xs font-semibold text-neutral-600"
                    >
                      产品编码（必填）
                    </label>
                    <Input
                      id="create-drawer-code"
                      type="text"
                      required
                      autoFocus
                      placeholder="例如 HB-108"
                      value={code}
                      onChange={(event) => setCode(event.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label
                      htmlFor="create-drawer-series"
                      className="text-xs font-semibold text-neutral-600"
                    >
                      系列（可输入自动识别）
                    </label>
                    <Input
                      id="create-drawer-series"
                      type="text"
                      list="create-drawer-series-options"
                      placeholder="输入系列编码 / 名称 / ID"
                      value={seriesInput}
                      onChange={(event) => setSeriesInput(event.target.value)}
                    />
                    <datalist id="create-drawer-series-options">
                      {seriesOptions.flatMap((item) => [
                        <option key={`${item.id}-code`} value={item.code}>
                          {item.name}
                        </option>,
                        <option key={`${item.id}-name`} value={item.name}>
                          {item.code}
                        </option>,
                        <option key={`${item.id}-id`} value={item.id}>
                          {item.name}
                        </option>,
                      ])}
                    </datalist>
                    {seriesResolveResult.type === 'matchedExisting' &&
                    seriesResolveResult.matched ? (
                      <p className="text-xs text-emerald-600">
                        已匹配系列：{seriesResolveResult.matched.name}（
                        {seriesResolveResult.matched.code}）
                      </p>
                    ) : null}
                    {needsNewSeries ? (
                      <p className="text-xs text-amber-700">
                        未匹配历史系列，将在提交时先创建新系列。
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-1.5">
                    <label
                      htmlFor="create-drawer-sex"
                      className="text-xs font-semibold text-neutral-600"
                    >
                      性别
                    </label>
                    <NativeSelect
                      id="create-drawer-sex"
                      value={sex}
                      onChange={(event) => setSex(event.target.value as CreateSex)}
                    >
                      <option value="">未知</option>
                      <option value="male">公</option>
                      <option value="female">母</option>
                    </NativeSelect>
                  </div>
                  {sex === 'female' ? (
                    <div className="grid gap-1.5">
                      <label
                        htmlFor="create-drawer-price"
                        className="text-xs font-semibold text-neutral-600"
                      >
                        子代单价
                      </label>
                      <Input
                        id="create-drawer-price"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="可选，如 18000"
                        value={offspringUnitPrice}
                        onChange={(event) => setOffspringUnitPrice(event.target.value)}
                      />
                    </div>
                  ) : null}
                </div>

                {needsNewSeries ? (
                  <div className="space-y-3 rounded-2xl border border-[#FFD400]/35 bg-[#FFF9D8] p-3">
                    <p className="text-xs font-semibold text-neutral-700">新系列补充信息</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        placeholder="系列编码（必填）"
                        value={newSeriesCode}
                        onChange={(event) => setNewSeriesCode(event.target.value.toUpperCase())}
                      />
                      <Input
                        placeholder="系列名称（必填）"
                        value={newSeriesName}
                        onChange={(event) => setNewSeriesName(event.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="排序（可选）"
                        value={newSeriesSortOrder}
                        onChange={(event) => setNewSeriesSortOrder(event.target.value)}
                      />
                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={newSeriesIsActive}
                          onChange={(event) => setNewSeriesIsActive(event.target.checked)}
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
                    />
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <label
                      htmlFor="create-drawer-sire"
                      className="text-xs font-semibold text-neutral-600"
                    >
                      父本编号
                    </label>
                    <Input
                      id="create-drawer-sire"
                      placeholder="可选"
                      value={sireCode}
                      onChange={(event) => setSireCode(event.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label
                      htmlFor="create-drawer-dam"
                      className="text-xs font-semibold text-neutral-600"
                    >
                      母本编号
                    </label>
                    <Input
                      id="create-drawer-dam"
                      placeholder="可选"
                      value={damCode}
                      onChange={(event) => setDamCode(event.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label
                      htmlFor="create-drawer-mate"
                      className="text-xs font-semibold text-neutral-600"
                    >
                      配偶编号
                    </label>
                    <Input
                      id="create-drawer-mate"
                      placeholder="可选"
                      value={mateCode}
                      onChange={(event) => setMateCode(event.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <label
                    htmlFor="create-drawer-description"
                    className="text-xs font-semibold text-neutral-600"
                  >
                    备注
                  </label>
                  <textarea
                    id="create-drawer-description"
                    rows={3}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="可选，记录来源/特征等"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

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
                <div className="flex flex-wrap gap-4 text-sm text-neutral-700">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={excludeFromBreeding}
                      onChange={(event) => setExcludeFromBreeding(event.target.checked)}
                    />
                    不参与繁殖
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hasSample}
                      onChange={(event) => setHasSample(event.target.checked)}
                    />
                    有样本
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={inStock}
                      onChange={(event) => setInStock(event.target.checked)}
                    />
                    在库
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(event) => setIsFeatured(event.target.checked)}
                    />
                    精选
                  </label>
                </div>
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

  async function createSeriesIfNeeded(input: {
    isDemoMode: boolean;
    code: string;
    name: string;
    description: string;
    sortOrder: string;
    isActive: boolean;
  }): Promise<ProductSeriesOption> {
    const nextSeriesCode = input.code.trim().toUpperCase();
    const nextSeriesName = input.name.trim();

    if (!nextSeriesCode || !nextSeriesName) {
      throw new Error('新系列需要填写系列编码和系列名称。');
    }

    const parsedSortOrder = parseSeriesSortOrder(input.sortOrder);

    if (input.isDemoMode) {
      return {
        id: `demo-series-${Date.now()}`,
        code: nextSeriesCode,
        name: nextSeriesName,
      };
    }

    const createSeriesPayload = createSeriesRequestSchema.parse({
      code: nextSeriesCode,
      name: nextSeriesName,
      description: input.description.trim() ? input.description.trim() : null,
      sortOrder: parsedSortOrder,
      isActive: input.isActive,
    });

    const createSeriesResponse = await apiRequest('/series', {
      method: 'POST',
      body: createSeriesPayload,
      requestSchema: createSeriesRequestSchema,
      responseSchema: createSeriesResponseSchema,
    });

    return {
      id: createSeriesResponse.series.id,
      code: createSeriesResponse.series.code,
      name: createSeriesResponse.series.name,
    };
  }
}

function resolveSeriesInput(
  input: string,
  seriesOptions: ProductSeriesOption[],
): SeriesResolveResult {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return {
      type: 'matchedExisting',
      input: '',
      seriesId: null,
      matched: null,
    };
  }

  const normalizedInput = normalizeText(trimmedInput);

  const codeMatched = seriesOptions.find((item) => normalizeText(item.code) === normalizedInput);
  if (codeMatched) {
    return {
      type: 'matchedExisting',
      input: trimmedInput,
      seriesId: codeMatched.id,
      matched: codeMatched,
    };
  }

  const nameMatched = seriesOptions.find((item) => normalizeText(item.name) === normalizedInput);
  if (nameMatched) {
    return {
      type: 'matchedExisting',
      input: trimmedInput,
      seriesId: nameMatched.id,
      matched: nameMatched,
    };
  }

  const idMatched = seriesOptions.find((item) => normalizeText(item.id) === normalizedInput);
  if (idMatched) {
    return {
      type: 'matchedExisting',
      input: trimmedInput,
      seriesId: idMatched.id,
      matched: idMatched,
    };
  }

  return {
    type: 'requireNewSeries',
    input: trimmedInput,
  };
}

function normalizePendingImages(items: PendingImageItem[]): PendingImageItem[] {
  return items.map((item, index) => ({
    ...item,
    localOrder: index,
  }));
}

function createLocalImageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `local-image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function releasePendingImageUrls(items: PendingImageItem[]) {
  items.forEach((item) => {
    URL.revokeObjectURL(item.previewUrl);
  });
}

function parseOffspringPrice(sex: CreateSex, input: string): number | null | 'invalid' {
  if (sex !== 'female') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    return 'invalid';
  }

  return value;
}

function parsePopularityScore(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return 0;
  }

  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    return null;
  }

  return value;
}

function parseSeriesSortOrder(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  const value = Number(trimmed);
  if (!Number.isInteger(value)) {
    throw new Error('系列排序必须是整数。');
  }

  return value;
}

function toSuggestedSeriesCode(input: string): string {
  const normalized = input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-_]/g, '-');
  const compact = normalized.replace(/-+/g, '-').replace(/^-|-$/g, '');

  return compact || 'NEW-SERIES';
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}
