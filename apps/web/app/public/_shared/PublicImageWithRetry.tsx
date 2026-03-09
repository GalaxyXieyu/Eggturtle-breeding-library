/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';

const PUBLIC_ASSET_BASE_URL = (process.env.NEXT_PUBLIC_PUBLIC_ASSET_BASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

function stripPublicAssetBase(url: string): string | null {
  if (!PUBLIC_ASSET_BASE_URL) {
    return null;
  }

  if (!url.startsWith(PUBLIC_ASSET_BASE_URL)) {
    return null;
  }

  const stripped = url.slice(PUBLIC_ASSET_BASE_URL.length).trim();
  if (!stripped) {
    return null;
  }

  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

type PublicImageWithRetryProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src: string;
  fallbackSrc?: string;
  onLoadSuccess?: () => void;
  onLoadFailure?: () => void;
  renderFallback?: () => React.ReactNode;
};

/**
 * 公开页面图片组件，支持 CDN 失败自动重试
 *
 * 重试策略：
 * 1. 首先尝试从 CDN 加载图片
 * 2. 如果失败，自动去掉 CDN 前缀，直接从 API 服务器加载
 * 3. 如果提供了 fallbackSrc，继续尝试 fallback 图片
 * 4. 如果都失败，显示 renderFallback 或默认占位符
 */
export default function PublicImageWithRetry({
  src,
  fallbackSrc,
  onLoadSuccess,
  onLoadFailure,
  renderFallback,
  alt = '',
  ...imgProps
}: PublicImageWithRetryProps) {
  const [imageSrc, setImageSrc] = useState(src);
  const [imageFailed, setImageFailed] = useState(false);
  const [hasRetriedWithoutCdn, setHasRetriedWithoutCdn] = useState(false);
  const [hasRetriedFallback, setHasRetriedFallback] = useState(false);

  useEffect(() => {
    setImageSrc(src);
    setImageFailed(false);
    setHasRetriedWithoutCdn(false);
    setHasRetriedFallback(false);
  }, [src]);

  function handleImageError() {
    if (!imageSrc) {
      setImageFailed(true);
      onLoadFailure?.();
      return;
    }

    // 第一次重试：去掉 CDN 前缀
    if (!hasRetriedWithoutCdn) {
      const fallbackFromCdn = stripPublicAssetBase(imageSrc);
      if (fallbackFromCdn) {
        setHasRetriedWithoutCdn(true);
        setImageSrc(fallbackFromCdn);
        return;
      }
    }

    // 第二次重试：使用 fallback 图片
    if (!hasRetriedFallback && fallbackSrc && imageSrc !== fallbackSrc) {
      setHasRetriedFallback(true);
      setImageSrc(fallbackSrc);
      return;
    }

    setImageFailed(true);
    onLoadFailure?.();
  }

  function handleImageLoad() {
    onLoadSuccess?.();
  }

  if (imageFailed) {
    if (renderFallback) {
      return <>{renderFallback()}</>;
    }
    return (
      <div className="h-full w-full bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200" />
    );
  }

  return (
    <img
      {...imgProps}
      src={imageSrc}
      alt={alt}
      onError={handleImageError}
      onLoad={handleImageLoad}
    />
  );
}
