import { useEffect, useMemo, useState } from 'react';
import { type Product, type ProductImage } from '@eggturtle/shared';
import { ArrowLeft, FileBadge2, HeartHandshake, Image as ImageIcon, PencilRuler } from 'lucide-react';
import { formatPrice, formatSex } from '@/lib/pet-format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';

type BreederInfoCardProps = {
  breeder: Product | null;
  seriesLabel: string | null;
  images: ProductImage[];
  activeImage: ProductImage | null;
  activeImageId: string | null;
  relationIds?: Partial<Record<keyof typeof relationPillStyles, string | null>>;
  onImageClick: (imageId: string) => void;
  onBack: () => void;
  onEdit: () => void;
  onOpenRelation?: (id: string) => void;
  onOpenCertificateDrawer: () => void;
  onOpenCouplePhotoDrawer: () => void;
  actionsDisabled?: boolean;
  actionErrorMessage?: string | null;
  resolveImageUrl: (url: string) => string;
};

const relationPillStyles = {
  父本: 'border-sky-200 bg-sky-50/90 text-sky-700',
  母本: 'border-pink-200 bg-pink-50/90 text-pink-700',
  配偶: 'border-amber-200 bg-amber-50/90 text-amber-700'
} as const;

function RelationPill({
  label,
  value,
  relationId,
  onOpen,
}: {
  label: keyof typeof relationPillStyles;
  value: string;
  relationId?: string | null;
  onOpen?: (id: string) => void;
}) {
  const isClickable = Boolean(relationId && onOpen && value !== '未关联');
  const className = `inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${relationPillStyles[label]} ${
    isClickable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sm' : ''
  }`;

  if (isClickable && relationId && onOpen) {
    return (
      <button type="button" onClick={() => onOpen(relationId)} className={className}>
        <span className="shrink-0 tracking-[0.08em]">{label}</span>
        <span className="min-w-0 truncate text-neutral-800/90">{value}</span>
      </button>
    );
  }

  return (
    <div className={className}>
      <span className="shrink-0 tracking-[0.08em]">{label}</span>
      <span className="min-w-0 truncate text-neutral-800/90">{value}</span>
    </div>
  );
}

function withMaxEdge(url: string, maxEdge: 480 | 960): string {
  if (!url.trim()) {
    return url;
  }

  try {
    const isAbsolute = /^https?:\/\//i.test(url);
    const parsed = new URL(url, 'http://localhost');
    parsed.searchParams.set('maxEdge', String(maxEdge));
    if (isAbsolute) {
      return parsed.toString();
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const joiner = url.includes('?') ? '&' : '?';
    return `${url}${joiner}maxEdge=${maxEdge}`;
  }
}

export function BreederInfoCard({
  breeder,
  seriesLabel,
  images,
  activeImage,
  activeImageId,
  relationIds,
  onImageClick,
  onBack,
  onEdit,
  onOpenRelation,
  onOpenCertificateDrawer,
  onOpenCouplePhotoDrawer,
  actionsDisabled = false,
  actionErrorMessage = null,
  resolveImageUrl
}: BreederInfoCardProps) {
  const activeImageSrc = useMemo(
    () => (activeImage ? withMaxEdge(resolveImageUrl(activeImage.url), 960) : null),
    [activeImage, resolveImageUrl]
  );
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  useEffect(() => {
    setHeroImageLoaded(false);
  }, [activeImageSrc]);

  return (
    <Card className="tenant-card-lift overflow-hidden rounded-3xl border-neutral-200/90 bg-white transition-all">
      <CardContent className="grid gap-6 p-0 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 border-b border-neutral-200/80 p-3 sm:p-4 lg:border-b-0 lg:border-r">
          <div className="relative overflow-hidden rounded-[28px] bg-neutral-100">
            <button
              type="button"
              data-ui="button"
              onClick={onBack}
              className="absolute left-3 top-3 z-10 inline-flex h-9 items-center gap-1 rounded-full border border-white/40 bg-black/55 px-3 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:bg-black/65 hover:text-white"
              aria-label="返回列表"
            >
              <ArrowLeft size={14} />
              返回
            </button>
            {activeImage ? (
              <>
                {!heroImageLoaded ? (
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-200 to-neutral-100" />
                ) : null}
                <img
                  src={activeImageSrc ?? resolveImageUrl(activeImage.url)}
                  alt={`${breeder?.code ?? 'breeder'} 图片`}
                  className={`aspect-[4/5] w-full object-cover transition-opacity duration-300 sm:aspect-[5/6] lg:min-h-[420px] lg:aspect-auto ${
                    heroImageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  onLoad={() => setHeroImageLoaded(true)}
                  onError={() => setHeroImageLoaded(true)}
                />
              </>
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
                    data-ui="button"
                    onClick={() => onImageClick(image.id)}
                    className={`overflow-hidden rounded-2xl border bg-white transition-all ${
                      image.id === activeImageId
                        ? 'border-[#FFD400] shadow-[0_6px_20px_rgba(255,212,0,0.25)]'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                    aria-label={`查看图片 ${image.id === activeImageId ? '(当前)' : ''}`}
                  >
                    <img
                      src={withMaxEdge(resolveImageUrl(image.url), 480)}
                      alt="种龟缩略图"
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
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
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">名称</p>
            <CardTitle className="text-3xl text-neutral-900 sm:text-4xl">
              {breeder?.name?.trim() || breeder?.code || '种龟详情'}
            </CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RelationPill
              label="父本"
              value={breeder?.sireCode ?? '未关联'}
              relationId={relationIds?.父本}
              onOpen={onOpenRelation}
            />
            <RelationPill
              label="母本"
              value={breeder?.damCode ?? '未关联'}
              relationId={relationIds?.母本}
              onOpen={onOpenRelation}
            />
            <RelationPill
              label="配偶"
              value={breeder?.mateCode ?? '未关联'}
              relationId={relationIds?.配偶}
              onOpen={onOpenRelation}
            />
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">说明</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
              {breeder?.description?.trim() || '暂无说明'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {breeder ? (
              <Button variant="primary" onClick={onEdit}>
                <PencilRuler size={16} />
                编辑资料
              </Button>
            ) : null}
            <Button variant="outline" className="bg-white" onClick={onOpenCertificateDrawer} disabled={actionsDisabled}>
              <FileBadge2 size={16} />
              生成证书
            </Button>
            {breeder?.sex?.toLowerCase() === 'female' ? (
              <Button variant="outline" className="bg-white" onClick={onOpenCouplePhotoDrawer} disabled={actionsDisabled}>
                <HeartHandshake size={16} />
                生成夫妻图
              </Button>
            ) : null}
          </div>
          {actionErrorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionErrorMessage}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
