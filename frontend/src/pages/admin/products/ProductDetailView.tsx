import React from "react";

import { Button } from "@/components/ui/button";
import type { Product } from "@/types/products";

import { ChevronLeft, ChevronRight, Edit, Eye } from "lucide-react";

export type ProductImagePreview = {
  id: string;
  preview: string;
};

type Props = {
  product: Product;
  imageUploads: ProductImagePreview[];
  currentImageIndex: number;
  onPrevImage: () => void;
  onNextImage: () => void;
  onSelectImageIndex: (index: number) => void;
  onClose: () => void;
  onEdit: () => void;
};

export function ProductDetailView({
  product,
  imageUploads,
  currentImageIndex,
  onPrevImage,
  onNextImage,
  onSelectImageIndex,
  onClose,
  onEdit,
}: Props) {
  return (
    <div className="mt-6 space-y-6">
      <div>
        {imageUploads.length > 0 ? (
          <div className="mb-4">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
              <img
                src={imageUploads[currentImageIndex]?.preview}
                alt={product.name}
                className="h-full w-full object-cover"
              />

              {imageUploads.length > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 border-none h-8 w-8 ${
                      currentImageIndex === 0
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                    onClick={onPrevImage}
                    disabled={currentImageIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-1 border-none h-8 w-8 ${
                      currentImageIndex === imageUploads.length - 1
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                    onClick={onNextImage}
                    disabled={currentImageIndex === imageUploads.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {imageUploads.length > 1 && (
              <div className="mt-2">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {imageUploads.map((upload, index) => (
                    <div
                      key={upload.id}
                      className={`relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all duration-200 ${
                        index === currentImageIndex
                          ? "border-gray-900"
                          : "border-transparent"
                      } cursor-pointer`}
                      onClick={() => onSelectImageIndex(index)}
                      title="点击查看图片"
                    >
                      <img
                        src={upload.preview}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center mb-4">
            <div className="text-gray-300">
              <Eye className="h-12 w-12" />
            </div>
          </div>
        )}

        <h3 className="text-xl font-medium text-gray-900">{product.name}</h3>
        <p className="text-sm text-gray-600 mt-1">编号: {product.code}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-900 mb-1">产品描述</p>
        <p className="text-gray-600 text-sm">{product.description}</p>
      </div>

      <div className="flex justify-end gap-4 mt-8">
        <Button
          variant="outline"
          className="border-gray-300 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          onClick={onClose}
        >
          关闭
        </Button>
        <Button className="bg-gray-900 hover:bg-gray-800 text-white" onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" />
          编辑产品
        </Button>
      </div>
    </div>
  );
}
