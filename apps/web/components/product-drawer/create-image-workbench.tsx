/* eslint-disable @next/next/no-img-element */
'use client';

import type { ChangeEvent } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PendingImageItem } from '@/components/product-drawer/image-utils';

type ProductCreateImageWorkbenchProps = {
  submitting: boolean;
  selectedImageCount: number;
  pendingImages: PendingImageItem[];
  currentImageIndex: number;
  currentImage: PendingImageItem | null;
  hasMultipleImages: boolean;
  onAddPendingImages: (event: ChangeEvent<HTMLInputElement>) => void;
  onSetMainPendingImage: (targetId: string) => void;
  onMovePendingImage: (index: number, direction: -1 | 1) => void;
  onRemovePendingImage: (targetId: string) => void;
  onSetCurrentImageIndex: (index: number) => void;
};

export default function ProductCreateImageWorkbench({
  submitting,
  selectedImageCount,
  pendingImages,
  currentImageIndex,
  currentImage,
  hasMultipleImages,
  onAddPendingImages,
  onSetMainPendingImage,
  onMovePendingImage,
  onRemovePendingImage,
  onSetCurrentImageIndex,
}: ProductCreateImageWorkbenchProps) {
  return (
    <>
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
              onChange={onAddPendingImages}
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
            <p className="mt-1 text-xs text-neutral-500">推荐先上传 1-3 张主视角图，后续可随时补图。</p>
          </label>
          {selectedImageCount === 0 ? (
            <p className="text-xs text-neutral-500">也可不上传图片，直接填写下方资料并创建。</p>
          ) : (
            <p className="text-xs text-neutral-500">第一张会默认设为主图，可在下方预览区调整。</p>
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
              <div className="relative aspect-square">
                <img
                  src={currentImage.previewUrl}
                  alt={`待上传图片 ${currentImageIndex + 1}`}
                  className="h-full w-full object-cover"
                />

                <div className="absolute left-3 top-3 flex items-center gap-2">
                  {currentImage.isMain ? (
                    <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs text-white">主图</span>
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
                      onClick={() => onSetCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
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
                      onClick={() => onSetCurrentImageIndex(Math.min(pendingImages.length - 1, currentImageIndex + 1))}
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
                onClick={() => onSetMainPendingImage(currentImage.id)}
                disabled={submitting || currentImage.isMain}
              >
                <Star size={14} />
                设为主图
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onMovePendingImage(currentImageIndex, -1)}
                disabled={submitting || currentImageIndex === 0}
              >
                <ArrowUp size={14} />
                上移
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onMovePendingImage(currentImageIndex, 1)}
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
                onClick={() => onRemovePendingImage(currentImage.id)}
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
                      index === currentImageIndex ? 'border-neutral-900' : 'border-transparent'
                    }`}
                    onClick={() => onSetCurrentImageIndex(index)}
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
    </>
  );
}
