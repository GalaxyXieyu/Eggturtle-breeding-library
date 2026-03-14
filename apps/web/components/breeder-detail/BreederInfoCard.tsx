import { useMemo } from 'react';
import { type Product, type ProductImage } from '@eggturtle/shared';
import { FileBadge2, HeartHandshake, Image as ImageIcon, Loader2, PencilRuler } from 'lucide-react';
import { resolveDistinctBreederName } from '@/lib/breeder-utils';
import { formatPrice, formatSex } from '@/lib/pet-format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { BreederHeroCarousel } from './BreederHeroCarousel';

type BreederInfoCardProps = {
  breeder: Product | null;
  seriesLabel: string | null;
  images: ProductImage[];
  activeImageId: string | null;
  relationIds?: Partial<Record<keyof typeof relationPillStyles, string | null>>;
  onImageClick: (imageId: string) => void;
  onBack: () => void;
  onEdit: () => void;
  onOpenRelation?: (id: string) => void;
  onOpenCertificateDrawer: () => void;
  onOpenCouplePhotoDrawer: () => void;
  generatingCouplePhoto?: boolean;
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
  activeImageId,
  relationIds,
  onImageClick,
  onBack,
  onEdit,
  onOpenRelation,
  onOpenCertificateDrawer,
  onOpenCouplePhotoDrawer,
  generatingCouplePhoto = false,
  actionsDisabled = false,
  actionErrorMessage = null,
  resolveImageUrl
}: BreederInfoCardProps) {
  const breederCode = breeder?.code?.trim() ?? '';
  const breederDistinctName = useMemo(
    () => resolveDistinctBreederName(breeder?.code, breeder?.name),
    [breeder?.code, breeder?.name],
  );
  const breederTitle = (breederDistinctName ?? breederCode) || '种龟详情';
  const heroItems = images.map((image) => ({
    id: image.id,
    src: withMaxEdge(resolveImageUrl(image.url), 960),
    thumbnailSrc: withMaxEdge(resolveImageUrl(image.url), 480),
    alt: `${breeder?.code ?? 'breeder'} 图片`,
  }));
  const detailContent = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={breeder?.inStock ? 'success' : 'default'}>
          {breeder?.inStock ? '启用中' : '停用'}
        </Badge>
        <Badge variant="accent">{formatSex(breeder?.sex, { unknownLabel: '未知' })}</Badge>
        <Badge variant="sky">{seriesLabel ?? '未关联系列'}</Badge>
        {typeof breeder?.offspringUnitPrice === 'number' ? (
          <Badge variant="warning">子代 ¥ {formatPrice(breeder.offspringUnitPrice)}</Badge>
        ) : null}
        {breeder?.sex?.toLowerCase() === 'female' && typeof breeder?.offspringUnitPrice !== 'number' ? (
          <Badge variant="warning">待填子代单价</Badge>
        ) : null}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">名称</p>
        <CardTitle className="text-3xl text-neutral-900 sm:text-4xl">
          {breederTitle}
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
        {breeder?.sex?.toLowerCase() === 'female' ? (
          <>
            <Button variant="outline" className="bg-white" onClick={onOpenCertificateDrawer} disabled={actionsDisabled}>
              <FileBadge2 size={16} />
              生成证书
            </Button>
            <Button
              variant="outline"
              className="bg-white"
              onClick={onOpenCouplePhotoDrawer}
              disabled={actionsDisabled || generatingCouplePhoto}
            >
              {generatingCouplePhoto ? <Loader2 size={16} className="animate-spin" /> : <HeartHandshake size={16} />}
              {generatingCouplePhoto ? '生成中...' : '生成夫妻图'}
            </Button>
          </>
        ) : null}
      </div>
      {actionErrorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionErrorMessage}
        </p>
      ) : null}
    </>
  );

  return (
    <>
      <div className="space-y-4 lg:hidden">
        <div className="-mx-2 sm:-mx-3">
          <BreederHeroCarousel
            items={heroItems}
            activeId={activeImageId}
            onSelect={onImageClick}
            onBack={onBack}
            title={breederCode || breederTitle}
            subtitle={breederCode && breederDistinctName ? breederDistinctName : null}
            emptyState={<ImageIcon size={42} />}
            variant="immersive"
          />
        </div>

        <Card className="tenant-card-lift overflow-hidden rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardContent className="space-y-5 p-5 sm:p-6">
            {detailContent}
          </CardContent>
        </Card>
      </div>

      <Card className="tenant-card-lift hidden overflow-hidden rounded-3xl border-neutral-200/90 bg-white transition-all lg:block">
        <CardContent className="grid gap-6 p-0 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3 border-b border-neutral-200/80 p-3 sm:p-4 lg:border-b-0 lg:border-r">
            <BreederHeroCarousel
              items={heroItems}
              activeId={activeImageId}
              onSelect={onImageClick}
              onBack={onBack}
              title={breederCode || breederTitle}
              subtitle={breederCode && breederDistinctName ? breederDistinctName : null}
              emptyState={<ImageIcon size={42} />}
            />
          </div>

          <div className="space-y-5 p-6">
            {detailContent}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
