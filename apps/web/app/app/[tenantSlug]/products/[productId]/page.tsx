/* eslint-disable @next/next/no-img-element */
'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  type ProductImage,
} from '@eggturtle/shared';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Star,
  Trash2,
} from 'lucide-react';

import {
  apiRequest,
  resolveAuthenticatedAssetUrl,
} from '../../../../../lib/api-client';
import { formatApiError } from '../../../../../lib/error-utils';
import { ensureTenantRouteSession } from '../../../../../lib/tenant-route-session';
import { uploadSingleFileWithAuth } from '../../../../../lib/upload-client';
import { Badge } from '../../../../../components/ui/badge';
import { Button } from '../../../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../../components/ui/card';
import { Input } from '../../../../../components/ui/input';
import { NativeSelect } from '../../../../../components/ui/native-select';

type SeriesOption = {
  id: string;
  code: string;
  name: string;
};

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

const DEFAULT_PRODUCT_EDIT_FORM: ProductEditFormState = {
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
  isFeatured: false,
};

export default function ProductImagesPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string; productId: string }>();
  const searchParams = useSearchParams();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const productId = useMemo(() => params.productId ?? '', [params.productId]);
  const isDemoMode = searchParams.get('demo') === '1';

  const [images, setImages] = useState<ProductImage[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [seriesOptions, setSeriesOptions] = useState<SeriesOption[]>([]);
  const [form, setForm] = useState<ProductEditFormState>(DEFAULT_PRODUCT_EDIT_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const currentImage = images[currentImageIndex] ?? images[0] ?? null;
  const hasMultipleImages = images.length > 1;

  const loadImages = useCallback(async () => {
    const response = await apiRequest(`/products/${productId}/images`, {
      responseSchema: listProductImagesResponseSchema,
    });

    setImages(response.images);
  }, [productId]);

  const loadProductMeta = useCallback(async () => {
    if (isDemoMode) {
      const demoProduct = createDemoProduct(productId);
      setProduct(demoProduct);
      setForm(toProductEditFormState(demoProduct));
      setSeriesOptions([
        { id: 'demo-series-mg', code: 'MG', name: '曼谷系' },
        { id: 'demo-series-hb', code: 'HB', name: '花背系' },
      ]);
      return;
    }

    const [productResponse, seriesResponse] = await Promise.all([
      apiRequest(`/products/${productId}`, {
        responseSchema: getProductResponseSchema,
      }),
      apiRequest('/series?page=1&pageSize=100', {
        responseSchema: listSeriesResponseSchema,
      }),
    ]);

    setProduct(productResponse.product);
    setForm(toProductEditFormState(productResponse.product));
    setSeriesOptions(
      seriesResponse.items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
      })),
    );
  }, [isDemoMode, productId]);

  useEffect(() => {
    if (!tenantSlug || !productId) {
      setError('缺少 tenantSlug 或 productId。');
      setLoading(false);
      return;
    }

    if (isDemoMode) {
      setImages(createDemoImages(productId));
      void loadProductMeta();
      setError(null);
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const access = await ensureTenantRouteSession({
          tenantSlug,
          missingTenantMessage: '缺少 tenantSlug。',
          router,
        });

        if (!access.ok) {
          if (access.reason === 'missing-tenant') {
            setError(access.message ?? '缺少 tenantSlug。');
            setLoading(false);
          }
          return;
        }

        await Promise.all([loadProductMeta(), loadImages()]);
        setError(null);
      } catch (requestError) {
        setError(formatApiError(requestError));
      } finally {
        setLoading(false);
      }
    })();
  }, [isDemoMode, loadImages, loadProductMeta, productId, router, tenantSlug]);

  useEffect(() => {
    if (images.length === 0) {
      setCurrentImageIndex(0);
      return;
    }

    if (currentImageIndex > images.length - 1) {
      setCurrentImageIndex(images.length - 1);
    }
  }, [currentImageIndex, images.length]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    if (isDemoMode) {
      setSubmitting(false);
      setMessage('Demo 模式仅展示 UI，不执行真实上传。');
      event.target.value = '';
      return;
    }

    try {
      const files = Array.from(fileList);
      for (const file of files) {
        await uploadSingleFileWithAuth(
          `/products/${productId}/images`,
          file,
          uploadProductImageResponseSchema,
        );
      }
      await loadImages();
      setMessage(`已上传 ${files.length} 张图片。`);
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSubmitting(false);
      event.target.value = '';
    }
  }

  async function handleDeleteImage(imageId: string) {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    if (isDemoMode) {
      setImages((currentImages) => currentImages.filter((item) => item.id !== imageId));
      setSubmitting(false);
      setMessage('Demo 模式：已从页面移除图片。');
      return;
    }

    try {
      await apiRequest(`/products/${productId}/images/${imageId}`, {
        method: 'DELETE',
        responseSchema: deleteProductImageResponseSchema,
      });
      await loadImages();
      setMessage('图片已删除。');
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetMain(imageId: string) {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    if (isDemoMode) {
      setImages((currentImages) =>
        currentImages.map((item) => ({
          ...item,
          isMain: item.id === imageId,
        })),
      );
      setSubmitting(false);
      setMessage('Demo 模式：主图标记已更新。');
      return;
    }

    try {
      const response = await apiRequest(`/products/${productId}/images/${imageId}/main`, {
        method: 'PUT',
        responseSchema: setMainProductImageResponseSchema,
      });

      setImages((currentImages) =>
        currentImages.map((item) => {
          if (item.id === response.image.id) {
            return response.image;
          }

          if (item.isMain) {
            return { ...item, isMain: false };
          }

          return item;
        }),
      );
      setMessage('主图已更新。');
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) {
      return;
    }

    const reordered = [...images];
    const [movedImage] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, movedImage);

    setSubmitting(true);
    setMessage(null);
    setError(null);

    if (isDemoMode) {
      setImages(reordered);
      setSubmitting(false);
      setMessage('Demo 模式：图片顺序已更新。');
      return;
    }

    try {
      const payload = reorderProductImagesRequestSchema.parse({
        imageIds: reordered.map((item) => item.id),
      });

      const response = await apiRequest(`/products/${productId}/images/reorder`, {
        method: 'PUT',
        body: payload,
        requestSchema: reorderProductImagesRequestSchema,
        responseSchema: reorderProductImagesResponseSchema,
      });

      setImages(response.images);
      setMessage('图片顺序已更新。');
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveProfile() {
    if (!product) {
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

    setSavingProfile(true);
    setMessage(null);
    setError(null);

    try {
      const payload = updateProductRequestSchema.parse({
        code: normalizedCode,
        description: form.description.trim() ? form.description.trim() : null,
        seriesId: form.seriesId.trim() ? form.seriesId.trim() : null,
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
      });

      if (isDemoMode) {
        const next: Product = {
          ...product,
          code: normalizedCode,
          description: form.description.trim() ? form.description.trim() : null,
          seriesId: form.seriesId.trim() ? form.seriesId.trim() : null,
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
          updatedAt: new Date().toISOString(),
        };
        setProduct(next);
        setForm(toProductEditFormState(next));
        setMessage('Demo 模式：产品资料已更新。');
        return;
      }

      const response = await apiRequest(`/products/${productId}`, {
        method: 'PUT',
        body: payload,
        requestSchema: updateProductRequestSchema,
        responseSchema: getProductResponseSchema,
      });

      setProduct(response.product);
      setForm(toProductEditFormState(response.product));
      setMessage('产品资料已保存。');
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <main className="space-y-4 pb-10 sm:space-y-6">
      <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-3xl">产品图片管理</CardTitle>
            <CardDescription>
              租户：{tenantSlug} · 产品 ID：{productId}
            </CardDescription>
          </div>
          <Button variant="secondary" onClick={() => router.push(`/app/${tenantSlug}/products`)}>
            返回产品列表
          </Button>
        </CardHeader>
      </Card>

      <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
        <CardHeader>
          <CardTitle className="text-2xl">产品资料</CardTitle>
          <CardDescription>可直接编辑编码、系列、性别、谱系和业务参数。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="edit-product-code" className="text-xs font-semibold text-neutral-600">
                编码
              </label>
              <Input
                id="edit-product-code"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor="edit-product-series"
                className="text-xs font-semibold text-neutral-600"
              >
                系列
              </label>
              <NativeSelect
                id="edit-product-series"
                value={form.seriesId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, seriesId: event.target.value }))
                }
              >
                <option value="">不选择系列</option>
                {form.seriesId && !seriesOptions.some((item) => item.id === form.seriesId) ? (
                  <option value={form.seriesId}>当前系列（{form.seriesId}）</option>
                ) : null}
                {seriesOptions.map((item) => (
                  <option key={`edit-series-${item.id}`} value={item.id}>
                    {item.name}（{item.code}）
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="edit-product-sex" className="text-xs font-semibold text-neutral-600">
                性别
              </label>
              <NativeSelect
                id="edit-product-sex"
                value={form.sex}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sex: event.target.value as ProductEditFormState['sex'],
                  }))
                }
              >
                <option value="">未知</option>
                <option value="male">公</option>
                <option value="female">母</option>
              </NativeSelect>
            </div>
            {form.sex === 'female' ? (
              <div className="grid gap-1.5">
                <label
                  htmlFor="edit-product-price"
                  className="text-xs font-semibold text-neutral-600"
                >
                  子代单价
                </label>
                <Input
                  id="edit-product-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.offspringUnitPrice}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      offspringUnitPrice: event.target.value,
                    }))
                  }
                />
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <label htmlFor="edit-product-sire" className="text-xs font-semibold text-neutral-600">
                父本编号
              </label>
              <Input
                id="edit-product-sire"
                value={form.sireCode}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sireCode: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="edit-product-dam" className="text-xs font-semibold text-neutral-600">
                母本编号
              </label>
              <Input
                id="edit-product-dam"
                value={form.damCode}
                onChange={(event) =>
                  setForm((current) => ({ ...current, damCode: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="edit-product-mate" className="text-xs font-semibold text-neutral-600">
                配偶编号
              </label>
              <Input
                id="edit-product-mate"
                value={form.mateCode}
                onChange={(event) =>
                  setForm((current) => ({ ...current, mateCode: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor="edit-product-popularity"
                className="text-xs font-semibold text-neutral-600"
              >
                热度分
              </label>
              <Input
                id="edit-product-popularity"
                type="number"
                min={0}
                max={100}
                value={form.popularityScore}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    popularityScore: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <label
              htmlFor="edit-product-description"
              className="text-xs font-semibold text-neutral-600"
            >
              描述
            </label>
            <textarea
              id="edit-product-description"
              rows={3}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-neutral-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.excludeFromBreeding}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    excludeFromBreeding: event.target.checked,
                  }))
                }
              />
              不参与繁殖
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.hasSample}
                onChange={(event) =>
                  setForm((current) => ({ ...current, hasSample: event.target.checked }))
                }
              />
              有样本
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.inStock}
                onChange={(event) =>
                  setForm((current) => ({ ...current, inStock: event.target.checked }))
                }
              />
              在库
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isFeatured: event.target.checked }))
                }
              />
              精选
            </label>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={loading || savingProfile}
            >
              {savingProfile ? '保存中...' : '保存资料'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ImagePlus size={18} />
              上传图片
            </CardTitle>
            <CardDescription>支持 JPG / PNG / WEBP / GIF，单图最大 10MB。</CardDescription>
          </div>
          {!loading ? <Badge variant="accent">当前 {images.length} 张</Badge> : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {isDemoMode ? (
            <Card className="rounded-2xl border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-700">
                Demo 模式：用于 UI 预览，不会写入真实数据。
              </p>
            </Card>
          ) : null}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={submitting || loading}
            onChange={handleUpload}
            className="block w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
          />
        </CardContent>
      </Card>

      <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl">已上传图片</CardTitle>
          {!loading && currentImage ? (
            <CardDescription>
              当前第 {currentImageIndex + 1}/{images.length} 张 · 排序 #{currentImageIndex + 1}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="text-sm text-neutral-600">正在加载图片...</p> : null}
          {!loading && images.length === 0 ? (
            <p className="text-sm text-neutral-500">该产品暂无图片，先上传一张吧。</p>
          ) : null}

          {!loading && currentImage ? (
            <>
              <article className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                <div className="relative aspect-[4/3] bg-neutral-100 sm:aspect-video">
                  <img
                    src={resolveImageUrl(currentImage.url)}
                    alt={`产品图片 ${currentImageIndex + 1}`}
                    className="h-full w-full object-cover"
                  />

                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    {currentImage.isMain ? <Badge variant="accent">主图</Badge> : null}
                    <Badge>#{currentImageIndex + 1}</Badge>
                  </div>

                  <div className="absolute right-3 top-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 rounded-full bg-white/90 px-3 shadow-sm"
                      disabled={submitting || currentImage.isMain}
                      onClick={() => {
                        void handleSetMain(currentImage.id);
                      }}
                    >
                      <Star size={14} />
                      设主图
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      aria-label="删除当前图片"
                      className="h-8 w-8 rounded-full bg-white/90 shadow-sm"
                      disabled={submitting}
                      onClick={() => {
                        void handleDeleteImage(currentImage.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  {hasMultipleImages ? (
                    <>
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        aria-label="上一张图片"
                        className="absolute left-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white/90 shadow-sm"
                        disabled={currentImageIndex === 0}
                        onClick={() => {
                          setCurrentImageIndex((current) => Math.max(0, current - 1));
                        }}
                      >
                        <ChevronLeft size={16} />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        aria-label="下一张图片"
                        className="absolute right-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white/90 shadow-sm"
                        disabled={currentImageIndex === images.length - 1}
                        onClick={() => {
                          setCurrentImageIndex((current) =>
                            Math.min(images.length - 1, current + 1),
                          );
                        }}
                      >
                        <ChevronRight size={16} />
                      </Button>
                    </>
                  ) : null}

                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 text-xs font-medium text-white/95">
                    imageId: {currentImage.id}
                  </div>
                </div>
              </article>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={submitting || currentImageIndex === 0}
                  onClick={() => {
                    void handleMove(currentImageIndex, -1);
                  }}
                >
                  <ArrowUp size={14} />
                  上移
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={submitting || currentImageIndex === images.length - 1}
                  onClick={() => {
                    void handleMove(currentImageIndex, 1);
                  }}
                >
                  <ArrowDown size={14} />
                  下移
                </Button>
              </div>

              {hasMultipleImages ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                        index === currentImageIndex ? 'border-neutral-900' : 'border-transparent'
                      }`}
                      onClick={() => setCurrentImageIndex(index)}
                    >
                      <img
                        src={resolveImageUrl(image.url)}
                        alt={`缩略图 ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {image.isMain ? (
                        <span className="absolute left-1 top-1 rounded bg-black/65 px-1 py-0.5 text-[10px] font-medium text-white">
                          主图
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      {message ? (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-700">{message}</p>
        </Card>
      ) : null}
      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : null}
    </main>
  );
}

function resolveImageUrl(imageUrl: string) {
  return resolveAuthenticatedAssetUrl(imageUrl);
}

function toProductEditFormState(product: Product): ProductEditFormState {
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
    isFeatured: !!product.isFeatured,
  };
}

function createDemoProduct(productId: string): Product {
  const now = new Date().toISOString();

  return {
    id: productId,
    tenantId: 'demo-tenant',
    code: 'DEMO-PROD',
    type: 'breeder',
    name: 'Demo Product',
    description: 'Demo 模式产品资料',
    seriesId: 'demo-series-mg',
    sex: 'female',
    offspringUnitPrice: 12000,
    sireCode: 'DEMO-SIRE',
    damCode: 'DEMO-DAM',
    mateCode: 'DEMO-MATE',
    excludeFromBreeding: false,
    hasSample: true,
    inStock: true,
    popularityScore: 80,
    isFeatured: false,
    coverImageUrl: '/images/mg_01.jpg',
    createdAt: now,
    updatedAt: now,
  };
}

function createDemoImages(productId: string): ProductImage[] {
  const nowIso = new Date().toISOString();

  return [
    {
      id: `${productId}-demo-1`,
      tenantId: 'demo-tenant',
      productId,
      key: `${productId}/demo-1`,
      url: '/images/mg_01.jpg',
      contentType: 'image/jpeg',
      sizeBytes: '204800',
      sortOrder: 0,
      isMain: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${productId}-demo-2`,
      tenantId: 'demo-tenant',
      productId,
      key: `${productId}/demo-2`,
      url: '/images/mg_02.jpg',
      contentType: 'image/jpeg',
      sizeBytes: '189440',
      sortOrder: 1,
      isMain: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${productId}-demo-3`,
      tenantId: 'demo-tenant',
      productId,
      key: `${productId}/demo-3`,
      url: '/images/mg_03.jpg',
      contentType: 'image/jpeg',
      sizeBytes: '176128',
      sortOrder: 2,
      isMain: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}

function parsePopularityScore(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return parsed;
}

function parseOffspringUnitPrice(
  sex: ProductEditFormState['sex'],
  value: string,
): number | null | 'invalid' {
  if (sex !== 'female') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 'invalid';
  }

  return parsed;
}
