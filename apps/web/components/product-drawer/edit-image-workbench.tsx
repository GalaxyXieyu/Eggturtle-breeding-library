/* eslint-disable @next/next/no-img-element */
'use client';

import type { ChangeEvent } from 'react';
import type { ProductImage } from '@eggturtle/shared';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Star,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { resolveDrawerImageUrl } from '@/components/product-drawer/image-utils';

type ProductEditImageWorkbenchProps = {
  productId: string;
  isDemoMode: boolean;
  submittingImages: boolean;
  loadingImages: boolean;
  images: ProductImage[];
  currentImage: ProductImage | null;
  currentImageIndex: number;
  hasMultipleImages: boolean;
  imageMessage: string | null;
  imageError: string | null;
  onUploadImages: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  onDeleteImage: (imageId: string) => Promise<void> | void;
  onSetMainImage: (imageId: string) => Promise<void> | void;
  onMoveImage: (index: number, direction: -1 | 1) => Promise<void> | void;
  onSetCurrentImageIndex: (index: number) => void;
};

export default function ProductEditImageWorkbench({
  productId,
  isDemoMode,
  submittingImages,
  loadingImages,
  images,
  currentImage,
  currentImageIndex,
  hasMultipleImages,
  imageMessage,
  imageError,
  onUploadImages,
  onDeleteImage,
  onSetMainImage,
  onMoveImage,
  onSetCurrentImageIndex,
}: ProductEditImageWorkbenchProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200/90 bg-neutral-50/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-800">图片上传与管理</p>
        <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600">
          {loadingImages ? '加载中...' : `${images.length} 张`}
        </span>
      </div>

      {isDemoMode ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="text-xs font-medium text-blue-700">Demo 模式：仅预览 UI，不写入真实数据。</p>
        </div>
      ) : null}

      <label
        htmlFor={`edit-drawer-image-upload-${productId}`}
        className={`group block rounded-xl border border-dashed p-3 transition ${
          submittingImages
            ? 'cursor-not-allowed border-neutral-200 bg-white/80 opacity-70'
            : 'cursor-pointer border-neutral-300 bg-white hover:border-amber-300 hover:shadow-[0_8px_22px_rgba(245,158,11,0.14)]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 shadow-sm transition group-hover:border-amber-300 group-hover:text-amber-600">
            <ImagePlus size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">点击选择图片，可多选上传</p>
            <p className="text-xs text-neutral-500">JPG / PNG / WEBP / GIF，单图最大 10MB</p>
          </div>
          <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600">
            选择文件
          </span>
        </div>
      </label>
      <input
        id={`edit-drawer-image-upload-${productId}`}
        type="file"
        accept="image/*"
        multiple
        disabled={submittingImages}
        onChange={onUploadImages}
        className="sr-only"
      />

      {loadingImages ? <p className="text-xs text-neutral-500">正在加载图片...</p> : null}
      {!loadingImages && images.length === 0 ? (
        <p className="text-xs text-neutral-500">当前没有图片，先上传一张吧。</p>
      ) : null}

      {!loadingImages && currentImage ? (
        <>
          <article className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="relative aspect-square bg-neutral-100">
              <img
                src={resolveDrawerImageUrl(currentImage.url)}
                alt={`抽屉图片 ${currentImageIndex + 1}`}
                className="h-full w-full object-cover"
              />
              <div className="absolute left-2 top-2 flex items-center gap-2">
                {currentImage.isMain ? (
                  <span className="rounded bg-[#FFD400] px-1.5 py-0.5 text-[10px] font-semibold text-neutral-900">主图</span>
                ) : null}
                <span className="rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  #{currentImageIndex + 1}
                </span>
              </div>
              <div className="absolute right-2 top-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 rounded-full bg-white/90 px-2.5 text-xs"
                  disabled={submittingImages || currentImage.isMain}
                  onClick={() => void onSetMainImage(currentImage.id)}
                >
                  <Star size={12} />
                  设主图
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  aria-label="删除当前图片"
                  className="h-7 w-7 rounded-full bg-white/90"
                  disabled={submittingImages}
                  onClick={() => void onDeleteImage(currentImage.id)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          </article>

          <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="col-span-2"
              disabled={submittingImages || currentImageIndex === 0}
              onClick={() => void onMoveImage(currentImageIndex, -1)}
            >
              <ArrowUp size={13} />
              上移
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="col-span-2"
              disabled={submittingImages || currentImageIndex === images.length - 1}
              onClick={() => void onMoveImage(currentImageIndex, 1)}
            >
              <ArrowDown size={13} />
              下移
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="上一张图片"
              className="h-8 w-8 rounded-full"
              disabled={submittingImages || currentImageIndex === 0}
              onClick={() => onSetCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
            >
              <ChevronLeft size={15} />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="下一张图片"
              className="h-8 w-8 rounded-full"
              disabled={submittingImages || currentImageIndex === images.length - 1}
              onClick={() => onSetCurrentImageIndex(Math.min(images.length - 1, currentImageIndex + 1))}
            >
              <ChevronRight size={15} />
            </Button>
          </div>

          {hasMultipleImages ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={`drawer-image-thumb-${image.id}`}
                  type="button"
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                    index === currentImageIndex ? 'border-neutral-900' : 'border-transparent'
                  }`}
                  onClick={() => onSetCurrentImageIndex(index)}
                  disabled={submittingImages}
                >
                  <img
                    src={resolveDrawerImageUrl(image.url)}
                    alt={`抽屉缩略图 ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  {image.isMain ? (
                    <span className="absolute left-1 top-1 rounded bg-black/65 px-1 py-0.5 text-[9px] font-semibold text-white">
                      主
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {imageMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-semibold text-emerald-700">{imageMessage}</p>
        </div>
      ) : null}
      {imageError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs font-semibold text-red-700">{imageError}</p>
        </div>
      ) : null}
    </section>
  );
}
