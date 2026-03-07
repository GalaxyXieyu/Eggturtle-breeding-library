import { type Product, type ProductImage } from '@eggturtle/shared';
import { ArrowLeft, Image as ImageIcon, PencilRuler } from 'lucide-react';
import { formatPrice, formatSex, formatShortDate } from '@/lib/pet-format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';

type BreederInfoCardProps = {
  breeder: Product | null;
  seriesLabel: string | null;
  images: ProductImage[];
  activeImage: ProductImage | null;
  activeImageId: string | null;
  onImageClick: (imageId: string) => void;
  onBack: () => void;
  onEdit: () => void;
  onManageImages: () => void;
  resolveImageUrl: (url: string) => string;
};

const relationPillStyles = {
  父本: 'border-sky-200 bg-sky-50 text-sky-700',
  母本: 'border-pink-200 bg-pink-50 text-pink-700',
  配偶: 'border-amber-200 bg-amber-50 text-amber-700'
} as const;

function RelationPill({ label, value }: { label: keyof typeof relationPillStyles; value: string }) {
  return (
    <div
      className={`inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-2 text-center ${relationPillStyles[label]}`}
    >
      <span className="shrink-0 text-[10px] font-semibold tracking-[0.12em]">{label}</span>
      <span className="min-w-0 truncate text-xs font-semibold sm:text-sm">{value}</span>
    </div>
  );
}

export function BreederInfoCard({
  breeder,
  seriesLabel,
  images,
  activeImage,
  activeImageId,
  onImageClick,
  onBack,
  onEdit,
  onManageImages,
  resolveImageUrl
}: BreederInfoCardProps) {
  return (
    <Card className="tenant-card-lift overflow-hidden rounded-3xl border-neutral-200/90 bg-white transition-all">
      <CardContent className="grid gap-6 p-0 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 border-b border-neutral-200/80 p-3 sm:p-4 lg:border-b-0 lg:border-r">
          <div className="relative overflow-hidden rounded-[28px] bg-neutral-100">
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
              <img
                src={resolveImageUrl(activeImage.url)}
                alt={`${breeder?.code ?? 'breeder'} 图片`}
                className="aspect-[4/5] w-full object-cover sm:aspect-[5/6] lg:min-h-[420px] lg:aspect-auto"
              />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center text-neutral-400">
                <ImageIcon size={42} />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4">
              <p className="text-sm font-semibold text-white">{breeder?.code ?? '种龟详情'}</p>
              <p className="text-xs text-white/85">{breeder?.name ?? '未命名种龟'}</p>
            </div>
          </div>

          {images.length > 1 ? (
            <div className="space-y-2">
              <p className="px-1 text-xs font-medium text-neutral-500">点击下方缩略图可切换大图</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-4">
                {images.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => onImageClick(image.id)}
                    className={`overflow-hidden rounded-2xl border bg-white transition-all ${
                      image.id === activeImageId
                        ? 'border-[#FFD400] shadow-[0_6px_20px_rgba(255,212,0,0.25)]'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                    aria-label={`查看图片 ${image.id === activeImageId ? '(当前)' : ''}`}
                  >
                    <img src={resolveImageUrl(image.url)} alt="种龟缩略图" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-5 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={breeder?.inStock ? 'success' : 'default'}>
              {breeder?.inStock ? '启用中' : '停用'}
            </Badge>
            <Badge variant="accent">{formatSex(breeder?.sex, { unknownLabel: '未知' })}</Badge>
            <Badge variant="sky">{seriesLabel ?? '未关联系列'}</Badge>
            {typeof breeder?.offspringUnitPrice === 'number' ? (
              <Badge variant="warning">子代 ¥ {formatPrice(breeder.offspringUnitPrice)}</Badge>
            ) : null}
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">名称</p>
              <CardTitle className="text-3xl text-neutral-900 sm:text-4xl">
                {breeder?.name?.trim() || breeder?.code || '种龟详情'}
              </CardTitle>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">状态</p>
                <p className="mt-2 text-sm font-semibold text-neutral-900">
                  {breeder?.needMatingStatus === 'warning'
                    ? '逾期待配'
                    : breeder?.needMatingStatus === 'need_mating'
                      ? '待配'
                      : '正常'}
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">待配天数</p>
                <p className="mt-2 text-sm font-semibold text-neutral-900">
                  {typeof breeder?.daysSinceEgg === 'number' ? `第 ${breeder.daysSinceEgg} 天` : '暂无'}
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:col-span-2 xl:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">最近产蛋 / 交配</p>
                <p className="mt-2 text-sm font-semibold text-neutral-900">
                  {breeder?.lastEggAt ? formatShortDate(breeder.lastEggAt) : '暂无'} / {breeder?.lastMatingAt ? formatShortDate(breeder.lastMatingAt) : '暂无'}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <RelationPill label="父本" value={breeder?.sireCode ?? '未关联'} />
            <RelationPill label="母本" value={breeder?.damCode ?? '未关联'} />
            <RelationPill label="配偶" value={breeder?.mateCode ?? '未关联'} />
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">说明</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
              {breeder?.description?.trim() || '暂无说明'}
            </p>
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
