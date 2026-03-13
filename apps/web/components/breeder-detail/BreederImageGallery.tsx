import { type ProductImage } from '@eggturtle/shared';
import { Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageCarousel } from '@/components/ui/image-carousel';

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
      <CardContent>
        <ImageCarousel
          items={images.map((image) => ({
            id: image.id,
            src: resolveImageUrl(image.url),
            thumbnailSrc: resolveImageUrl(image.url),
            alt: '种龟图片',
          }))}
          activeId={activeImageId}
          onSelect={onImageClick}
          heroClassName="max-w-xl"
          imageClassName="aspect-[5/4] object-cover"
          emptyState={<ImageIcon size={42} />}
        />
      </CardContent>
    </Card>
  );
}
