import React from "react";

import { Button } from "@/components/ui/button";

import {
  ArrowUpToLine,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Upload,
  X,
} from "lucide-react";

import type { useProductImages } from "./useProductImages";

type ImagesHook = ReturnType<typeof useProductImages>;

type Props = {
  mode: "create" | "edit";
  productId?: string;
  images: ImagesHook;
};

export function ProductImagesManager({ mode, productId, images }: Props) {
  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-gray-900 mb-2">产品图片</p>

      {images.imageUploads.length > 0 ? (
        <div className="mb-4">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
            <img
              src={images.imageUploads[images.currentImageIndex]?.preview}
              alt="Product preview"
              className="h-full w-full object-cover"
            />

            <div className="absolute right-2 top-2 z-10 flex gap-2">
              {mode === "edit" && productId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-white/90 rounded-full px-3 border-none h-8"
                  onClick={async () => {
                    const img = images.imageUploads[images.currentImageIndex];
                    if (!img?.id) return;
                    await images.setMainImage({ productId, imageId: img.id });
                  }}
                >
                  设为主图
                </Button>
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-white rounded-full p-1 border-none h-8 w-8"
                onClick={() => {
                  const img = images.imageUploads[images.currentImageIndex];
                  if (!img?.id) return;
                  void images.removeImage({ mode, productId, imageId: img.id });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {images.imageUploads.length > 1 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 border-none h-8 w-8 ${
                    images.currentImageIndex === 0 ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={images.handlePrevImage}
                  disabled={images.currentImageIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 border-none h-8 w-8 ${
                    images.currentImageIndex === images.imageUploads.length - 1
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  onClick={images.handleNextImage}
                  disabled={images.currentImageIndex === images.imageUploads.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>

          {images.imageUploads.length > 1 ? (
            <div className="mt-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs text-gray-700 flex items-center gap-1">
                  <GripVertical className="h-3 w-3" />
                  拖拽或点击按钮可调整顺序
                </div>

                {mode === "edit" && productId && images.flags.hasImageOrderChanged ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    onClick={() => void images.saveOrder({ productId })}
                  >
                    保存排序
                  </Button>
                ) : null}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.imageUploads.map((upload, index) => (
                  <div
                    key={upload.id}
                    className={`group relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border-2 cursor-move transition-all duration-200 ${
                      index === images.currentImageIndex ? "border-gray-900" : "border-transparent"
                    } ${images.flags.draggedIndex === index ? "opacity-50 scale-95" : ""} ${
                      images.flags.dragOverIndex === index
                        ? "border-gray-900 border-dashed bg-gray-100"
                        : ""
                    }`}
                    draggable
                    onDragStart={(e) => images.drag.handleDragStart(e, index)}
                    onDragEnd={images.drag.handleDragEnd}
                    onDragOver={(e) => images.drag.handleDragOver(e, index)}
                    onDragLeave={images.drag.handleDragLeave}
                    onDrop={(e) => images.drag.handleDrop(e, index)}
                    onClick={() => images.setCurrentImageIndex(index)}
                    title="拖拽可调整图片顺序"
                  >
                    <img
                      src={upload.preview}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover pointer-events-none"
                    />

                    <div className="absolute top-1 left-1 bg-black/30 rounded p-0.5">
                      <GripVertical className="h-2 w-2 text-white" />
                    </div>

                    {images.imageUploads.length > 1 ? (
                      <div className="absolute top-1 right-1 z-10 flex flex-col gap-1 rounded bg-black/20 p-0.5 backdrop-blur-sm transition-opacity md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-6 w-6 p-0 bg-white/90 hover:bg-white text-gray-900 shadow-sm"
                          aria-label="置顶图片"
                          title="置顶"
                          disabled={index === 0}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            images.moveImageToFront(index);
                          }}
                        >
                          <ArrowUpToLine className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-6 w-6 p-0 bg-white/90 hover:bg-white text-gray-900 shadow-sm"
                          aria-label="左移图片"
                          title="左移"
                          disabled={index === 0}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            images.moveImageLeft(index);
                          }}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-6 w-6 p-0 bg-white/90 hover:bg-white text-gray-900 shadow-sm"
                          aria-label="右移图片"
                          title="右移"
                          disabled={index === images.imageUploads.length - 1}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            images.moveImageRight(index);
                          }}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : null}

                    {images.flags.dragOverIndex === index && images.flags.draggedIndex !== index ? (
                      <div className="absolute inset-0 bg-gray-200/50 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-900 bg-white px-1 py-0.5 rounded">
                          放置
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className="border-2 border-dashed border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={images.triggerFileInput}
      >
        <input
          type="file"
          ref={images.fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            void images.handleSelectFiles({ mode, productId, files });
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <Upload className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-600">点击上传产品图片</p>
          <p className="text-xs text-gray-500">支持 JPG/PNG/HEIC。上传后系统会自动居中裁切成 1:1。</p>
        </div>
      </div>
    </div>
  );
}
