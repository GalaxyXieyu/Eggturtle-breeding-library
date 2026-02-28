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

import { ApiError, apiRequest, getAccessToken, getApiBaseUrl } from '../../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../../lib/tenant-session';

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
    <main className="workspace-shell">
      <header className="workspace-head">
        <div className="stack">
          <h1>产品图片管理</h1>
          <p className="muted">租户：{tenantSlug}</p>
          <p className="muted">产品 ID：{productId}</p>
        </div>
        <button type="button" className="secondary" onClick={() => router.push(`/app/${tenantSlug}`)}>
          返回工作台
        </button>
      </header>

      <section className="card panel stack">
        <div className="row between">
          <h2>上传图片</h2>
          {!loading ? <p className="muted">当前 {images.length} 张</p> : null}
        </div>
        <p className="muted">支持 JPG / PNG / WEBP / GIF，单图最大 10MB。</p>
        {isDemoMode ? <p className="notice notice-info">Demo 模式：用于 UI 预览，不会写入真实数据。</p> : null}
        <input type="file" accept="image/*" multiple disabled={submitting || loading} onChange={handleUpload} />
      </section>

      <section className="card panel stack">
        <h2>已上传图片</h2>
        {loading ? <p className="notice notice-info">正在加载图片...</p> : null}
        {!loading && images.length === 0 ? <p className="notice notice-warning">该产品暂无图片，先上传一张吧。</p> : null}

        {!loading && images.length > 0 ? (
          <div className="product-image-grid">
            {images.map((image, index) => (
              <article key={image.id} className="product-image-card">
                <div className="product-image-preview">
                  <img src={resolveImageUrl(image.url)} alt={`产品图片 ${index + 1}`} className="product-image-preview-img" />
                  {image.isMain ? <span className="product-image-main-tag">主图</span> : null}
                </div>

                <div className="stack">
                  <p className="muted mono">imageId: {image.id}</p>
                  <p className="muted">排序：#{index + 1}</p>
                </div>

                <div className="inline-actions">
                  <button
                    type="button"
                    className="btn-compact secondary"
                    disabled={submitting || image.isMain}
                    onClick={() => {
                      void handleSetMain(image.id);
                    }}
                  >
                    设为主图
                  </button>
                  <button
                    type="button"
                    className="btn-compact secondary"
                    disabled={submitting || index === 0}
                    onClick={() => {
                      void handleMove(index, -1);
                    }}
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    className="btn-compact secondary"
                    disabled={submitting || index === images.length - 1}
                    onClick={() => {
                      void handleMove(index, 1);
                    }}
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    className="btn-compact"
                    disabled={submitting}
                    onClick={() => {
                      void handleDeleteImage(image.id);
                    }}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {message ? <p className="notice notice-success">{message}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
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
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  if (imageUrl.startsWith('/images/')) {
    return imageUrl;
  }

  return `${getApiBaseUrl()}${imageUrl}`;
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
