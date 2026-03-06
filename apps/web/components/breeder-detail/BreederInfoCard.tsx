import { type Product, type ProductImage } from '@eggturtle/shared';
import { ArrowLeft, Image as ImageIcon, PencilRuler } from 'lucide-react';
import { formatSex } from '@/lib/pet-format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { MetaItem } from './MetaItem';

type BreederInfoCardProps = {
  breeder: Product | null;
  activeImage: ProductImage | null;
  onBack: () => void;
  onEdit: () => void;
  onManageImages: () => void;
  resolveImageUrl: (url: string) => string;
};

export function BreederInfoCard({
  breeder,
  activeImage,
  onBack,
  onEdit,
  onManageImages,
  resolveImageUrl
}: BreederInfoCardProps) {
  return (
    <Card className="tenant-card-lift overflow-hidden rounded-3xl border-neutral-200/90 bg-white transition-all">
      <CardContent className="grid gap-6 p-0 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="relative bg-neutral-100">
          <button
            type="button"
            onClick={onBack}
            className="absolute left-3 top-3 z-10 inline-flex h-9 items-center gap-1 rounded-full border border-white/40 bg-black/55 px-3 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:bg-black/65"
            aria-label="返回列表"
          >
            <ArrowLeft size={14} />
            返回
          </button>
          {activeImage ? (
            <img src={resolveImageUrl(activeImage.url)} alt={`${breeder?.code ?? 'breeder'} 图片`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[280px] items-center justify-center text-neutral-400">
              <ImageIcon size={42} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4">
            <p className="text-sm font-semibold text-white">{breeder?.code ?? '种龟详情'}</p>
            <p className="text-xs text-white/85">{breeder?.name ?? '未命名种龟'}</p>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={breeder?.inStock ? 'success' : 'default'}>
              {breeder?.inStock ? '启用中' : '停用'}
            </Badge>
            <Badge variant="accent">{formatSex(breeder?.sex, { unknownLabel: 'unknown' })}</Badge>
            <Badge variant="sky">{breeder?.seriesId ?? '未关联系列'}</Badge>
          </div>
          <div>
            <CardTitle className="text-4xl text-neutral-900">{breeder?.code ?? '种龟详情'}</CardTitle>
            <CardDescription className="mt-2 text-base text-neutral-600">{breeder?.description ?? '暂无描述'}</CardDescription>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetaItem label="父本" value={breeder?.sireCode ?? '未关联'} />
            <MetaItem label="母本" value={breeder?.damCode ?? '未关联'} />
            <MetaItem label="配偶" value={breeder?.mateCode ?? '未关联'} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onBack}>
              返回列表
            </Button>
            {breeder ? (
              <Button variant="primary" onClick={onEdit}>
                <PencilRuler size={16} />
                编辑资料
              </Button>
            ) : null}
            {breeder ? (
              <Button variant="secondary" onClick={onManageImages}>
                图片管理
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
