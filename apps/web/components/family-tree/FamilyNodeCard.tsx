import Link from 'next/link';
import { cn } from '@/lib/utils';

type FamilyNodeLike = {
  id: string;
  code: string;
  thumbnailUrl?: string | null;
  coverImageUrl?: string | null;
  imageUrl?: string | null;
};

type FamilyNodeCardProps = {
  node: FamilyNodeLike | null | undefined;
  href?: string;
  onOpen?: (id: string) => void;
  highlight?: boolean;
  className?: string;
  codeClassName?: string;
  emptyLabel?: string;
  imageFit?: 'cover' | 'contain';
  imageResolver?: (url: string) => string;
};

function resolveNodeImageUrl(node: FamilyNodeLike, imageResolver?: (url: string) => string) {
  const raw = node.imageUrl ?? node.thumbnailUrl ?? node.coverImageUrl ?? null;
  if (!raw) {
    return null;
  }

  return imageResolver ? imageResolver(raw) : raw;
}

export function FamilyNodeCard({
  node,
  href,
  onOpen,
  highlight = false,
  className,
  codeClassName,
  emptyLabel = '未知',
  imageFit = 'cover',
  imageResolver
}: FamilyNodeCardProps) {
  if (!node) {
    return (
      <div
        className={cn(
          'flex w-24 flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 p-2 text-center',
          className
        )}
      >
        <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-100 text-[11px] text-neutral-400">
          {emptyLabel}
        </div>
        <div className={cn('w-full truncate text-[11px] font-medium text-neutral-400', codeClassName)}>-</div>
      </div>
    );
  }

  const imageUrl = resolveNodeImageUrl(node, imageResolver);
  const cardClassName = cn(
    'group flex w-24 flex-col items-center gap-2 rounded-xl border bg-white p-2 text-center shadow-sm transition',
    highlight
      ? 'border-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_8px_20px_rgba(245,158,11,0.22)]'
      : 'border-neutral-200 hover:border-amber-400 hover:shadow-md',
    className
  );

  const content = (
    <>
      <div className="aspect-square w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={node.code}
            className={cn(
              'h-full w-full',
              imageFit === 'contain' ? 'object-contain p-1.5' : 'object-cover'
            )}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
            <span className="text-[11px] text-neutral-400">暂无图</span>
          </div>
        )}
      </div>
      <div className={cn('w-full truncate px-1 text-[11px] font-medium leading-4 text-neutral-700', codeClassName)}>{node.code}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {content}
      </Link>
    );
  }

  if (onOpen) {
    return (
      <button type="button" className={cardClassName} onClick={() => onOpen(node.id)}>
        {content}
      </button>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}
