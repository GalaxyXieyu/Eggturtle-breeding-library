import { type ProductImage } from '@eggturtle/shared';
import { Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type BreederImageGalleryProps = {
  images: ProductImage[];
  activeImageId: string | null;
  onImageClick: (imageId: string) => void;
  resolveImageUrl: (url: string) => string;
};

export function BreederImageGallery({ images, activeImageId, onImageClick, resolveImageUrl }: BreederImageGalleryProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <ImageIcon size={18} />
          图片预览
        </CardTitle>
        <CardDescription>点击缩略图即可切换大图，排序与主图请在产品图片管理页操作。</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
        {images.map((image) => (
          <button
            key={image.id}
            type="button"
            onClick={() => onImageClick(image.id)}
            className={`overflow-hidden rounded-2xl border transition-all ${
              image.id === activeImageId
                ? 'border-[#FFD400] shadow-[0_6px_20px_rgba(255,212,0,0.25)]'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <img src={resolveImageUrl(image.url)} alt="种龟缩略图" className="h-24 w-full object-cover" />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
