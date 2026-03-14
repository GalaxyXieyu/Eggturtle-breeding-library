/* eslint-disable @next/next/no-img-element */
'use client';

import type { ChangeEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Star,
  Trash2,
} from 'lucide-react';

import ProductImageGallery, {
  type ProductImageGalleryItem,
} from '@/components/product-drawer/product-image-gallery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone';
import type { PendingImageItem } from '@/components/product-drawer/image-utils';

type ProductCreateImageWorkbenchProps = {
  submitting: boolean;
  selectedImageCount: number;
  pendingImages: PendingImageItem[];
  currentImageIndex: number;
  currentImage: PendingImageItem | null;
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
  onAddPendingImages,
  onSetMainPendingImage,
  onMovePendingImage,
  onRemovePendingImage,
  onSetCurrentImageIndex,
}: ProductCreateImageWorkbenchProps) {
  const galleryItems: ProductImageGalleryItem[] = pendingImages.map((item, index) => ({
    id: item.id,
    url: item.previewUrl,
    isMain: item.isMain,
    previewAlt: `待上传图片 ${index + 1}`,
    thumbnailAlt: `待上传缩略图 ${index + 1}`,
  }));

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
          <ImageUploadDropzone
            inputId="create-drawer-upload-images"
            multiple
            disabled={submitting}
            onChange={onAddPendingImages}
            actionText={selectedImageCount > 0 ? '继续添加图片' : '选择图片'}
            title={
              selectedImageCount > 0
                ? `已选择 ${selectedImageCount} 张图片，可继续追加上传`
                : '点击这里选择图片文件（支持多选）'
            }
            description="推荐先上传 1-3 张主视角图，后续可随时补图。"
          />
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
            <ProductImageGallery
              items={galleryItems}
              currentImageIndex={currentImageIndex}
              disabled={submitting}
              navigationMode="overlay"
              onSetCurrentImageIndex={onSetCurrentImageIndex}
            />

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
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
