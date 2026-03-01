'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  deleteProductImageResponseSchema,
  listProductImagesResponseSchema,
  reorderProductImagesRequestSchema,
  reorderProductImagesResponseSchema,
  setMainProductImageResponseSchema,
  uploadProductImageResponseSchema,
  type ProductImage
} from '@eggturtle/shared';
import { ArrowDown, ArrowUp, ImagePlus, Star } from 'lucide-react';

import { ApiError, apiRequest, getAccessToken, getApiBaseUrl, resolveAuthenticatedAssetUrl } from '../../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../../lib/tenant-session';
import { Badge } from '../../../../../components/ui/badge';
import { Button } from '../../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../components/ui/card';

export default function ProductImagesPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string; productId: string }>();
  const searchParams = useSearchParams();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const productId = useMemo(() => params.productId ?? '', [params.productId]);
  const isDemoMode = searchParams.get('demo') === '1';

  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    const response = await apiRequest(`/products/${productId}/images`, {
      responseSchema: listProductImagesResponseSchema
    });

    setImages(response.images);
  }, [productId]);

  useEffect(() => {
    if (!tenantSlug || !productId) {
      setError('缺少 tenantSlug 或 productId。');
      setLoading(false);
      return;
    }

    if (isDemoMode) {
      setImages(createDemoImages(productId));
      setError(null);
      setLoading(false);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
        await loadImages();
        setError(null);
      } catch (requestError) {
        setError(formatError(requestError));
      } finally {
        setLoading(false);
      }
    })();
  }, [isDemoMode, loadImages, productId, router, tenantSlug]);

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
        await uploadSingleProductImage(productId, file);
      }
      await loadImages();
      setMessage(`已上传 ${files.length} 张图片。`);
    } catch (requestError) {
      setError(formatError(requestError));
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
        responseSchema: deleteProductImageResponseSchema
      });
      await loadImages();
      setMessage('图片已删除。');
    } catch (requestError) {
      setError(formatError(requestError));
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
          isMain: item.id === imageId
        }))
      );
      setSubmitting(false);
      setMessage('Demo 模式：主图标记已更新。');
      return;
    }

    try {
      const response = await apiRequest(`/products/${productId}/images/${imageId}/main`, {
        method: 'PUT',
        responseSchema: setMainProductImageResponseSchema
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
        })
      );
      setMessage('主图已更新。');
    } catch (requestError) {
      setError(formatError(requestError));
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
        imageIds: reordered.map((item) => item.id)
      });

      const response = await apiRequest(`/products/${productId}/images/reorder`, {
        method: 'PUT',
        body: payload,
        requestSchema: reorderProductImagesRequestSchema,
        responseSchema: reorderProductImagesResponseSchema
      });

      setImages(response.images);
      setMessage('图片顺序已更新。');
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSubmitting(false);
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
              <p className="text-sm font-medium text-blue-700">Demo 模式：用于 UI 预览，不会写入真实数据。</p>
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
        <CardHeader>
          <CardTitle className="text-2xl">已上传图片</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-neutral-600">正在加载图片...</p> : null}
          {!loading && images.length === 0 ? <p className="text-sm text-neutral-500">该产品暂无图片，先上传一张吧。</p> : null}

          {!loading && images.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {images.map((image, index) => (
                <article key={image.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  <div className="relative h-44 bg-neutral-100">
                    <img src={resolveImageUrl(image.url)} alt={`产品图片 ${index + 1}`} className="h-full w-full object-cover" />
                    {image.isMain ? (
                      <div className="absolute left-3 top-3">
                        <Badge variant="accent">主图</Badge>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3 p-4">
                    <p className="text-xs text-neutral-500">排序：#{index + 1}</p>
                    <p className="truncate text-xs text-neutral-500">imageId: {image.id}</p>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={submitting || image.isMain}
                        onClick={() => {
                          void handleSetMain(image.id);
                        }}
                      >
                        <Star size={14} />
                        主图
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={submitting || index === 0}
                        onClick={() => {
                          void handleMove(index, -1);
                        }}
                      >
                        <ArrowUp size={14} />
                        上移
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={submitting || index === images.length - 1}
                        onClick={() => {
                          void handleMove(index, 1);
                        }}
                      >
                        <ArrowDown size={14} />
                        下移
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={submitting}
                        onClick={() => {
                          void handleDeleteImage(image.id);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
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

async function uploadSingleProductImage(productId: string, file: File) {
  const token = getAccessToken();
  const headers = new Headers();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${getApiBaseUrl()}/products/${productId}/images`, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store'
  });

  const payload = await parseJsonBody(response);

  if (!response.ok) {
    throw new ApiError(pickErrorMessage(payload, `Request failed with status ${response.status}`), response.status);
  }

  return uploadProductImageResponseSchema.parse(payload);
}

async function parseJsonBody(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function pickErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  if ('error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  return fallback;
}

function resolveImageUrl(imageUrl: string) {
  return resolveAuthenticatedAssetUrl(imageUrl);
}

function createDemoImages(productId: string): ProductImage[] {
  return [
    {
      id: `${productId}-demo-1`,
      tenantId: 'demo-tenant',
      productId,
      key: `${productId}/demo-1`,
      url: '/images/mg_01.jpg',
      contentType: 'image/jpeg',
      sortOrder: 0,
      isMain: true
    },
    {
      id: `${productId}-demo-2`,
      tenantId: 'demo-tenant',
      productId,
      key: `${productId}/demo-2`,
      url: '/images/mg_02.jpg',
      contentType: 'image/jpeg',
      sortOrder: 1,
      isMain: false
    },
    {
      id: `${productId}-demo-3`,
      tenantId: 'demo-tenant',
      productId,
      key: `${productId}/demo-3`,
      url: '/images/mg_03.jpg',
      contentType: 'image/jpeg',
      sortOrder: 2,
      isMain: false
    }
  ];
}

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
}
