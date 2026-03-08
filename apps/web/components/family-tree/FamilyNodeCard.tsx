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
  size?: 'default' | 'large';
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
  imageResolver,
  size = 'default'
}: FamilyNodeCardProps) {
  const isLarge = size === 'large';
  const shellClassName = isLarge ? 'w-28 gap-2.5 rounded-2xl p-2.5 sm:w-32' : 'w-24 gap-2 rounded-xl p-2';
  const imageFrameClassName = isLarge ? 'rounded-xl' : 'rounded-lg';
  const emptyTextClassName = isLarge ? 'text-xs' : 'text-[11px]';
  const codeTextClassName = isLarge ? 'px-1 text-xs leading-4' : 'px-1 text-[11px] leading-4';

  if (!node) {
    return (
      <div
        className={cn(
          'flex flex-col items-center border border-dashed border-neutral-300 bg-neutral-50/80 text-center',
          shellClassName,
          className
        )}
      >
        <div
          className={cn(
            'flex aspect-square w-full items-center justify-center border border-dashed border-neutral-300 bg-neutral-100 text-neutral-400',
            imageFrameClassName,
            emptyTextClassName
          )}
        >
          {emptyLabel}
        </div>
        <div className={cn('w-full truncate font-medium text-neutral-400', codeTextClassName, codeClassName)}>-</div>
      </div>
    );
  }

  const imageUrl = resolveNodeImageUrl(node, imageResolver);
  const cardClassName = cn(
    'group flex flex-col items-center border bg-white text-center shadow-sm transition',
    shellClassName,
    highlight
      ? 'border-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_8px_20px_rgba(245,158,11,0.22)]'
      : 'border-neutral-200 hover:border-amber-400 hover:shadow-md',
    className
  );

  const content = (
    <>
      <div className={cn('aspect-square w-full overflow-hidden border border-neutral-200 bg-neutral-50', imageFrameClassName)}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={node.code}
            className={cn(
              'h-full w-full',
              imageFit === 'contain' ? (isLarge ? 'object-contain p-2' : 'object-contain p-1.5') : 'object-cover'
            )}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
            <span className={cn('text-neutral-400', emptyTextClassName)}>暂无图</span>
          </div>
        )}
      </div>
      <div className={cn('w-full truncate font-medium text-neutral-700', codeTextClassName, codeClassName)}>{node.code}</div>
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
