import Link from 'next/link';
import { cn } from '@/lib/utils';

type FamilyNodeLike = {
  id: string;
  code: string;
  publicUrl?: string | null;
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
  const raw = node.publicUrl ?? node.imageUrl ?? node.thumbnailUrl ?? node.coverImageUrl ?? null;
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
  size = 'default',
}: FamilyNodeCardProps) {
  const isLarge = size === 'large';
  // Slightly larger cards so family tree images are more legible (T86).
  // Keep mobile from breaking by increasing widths conservatively and keeping square media.
  const shellClassName = isLarge
    ? 'w-32 gap-2.5 rounded-2xl p-2.5 sm:w-36'
    : 'w-28 gap-2 rounded-xl p-2 sm:w-32';
  const imageFrameClassName = isLarge ? 'rounded-xl' : 'rounded-lg';
  const emptyTextClassName = isLarge ? 'text-xs' : 'text-[11px]';
  const codeTextClassName = isLarge ? 'px-1 text-xs leading-4' : 'px-1 text-[11px] leading-4';

  if (!node) {
    return (
      <div
        className={cn(
          'flex flex-col items-center border border-dashed border-neutral-300 bg-neutral-50/80 text-center dark:border-white/15 dark:bg-neutral-950/50',
          shellClassName,
          className,
        )}
      >
        <div
          className={cn(
            'flex aspect-square w-full items-center justify-center border border-dashed border-neutral-300 bg-neutral-100 text-neutral-400 dark:border-white/15 dark:bg-neutral-900/80 dark:text-neutral-500',
            imageFrameClassName,
            emptyTextClassName,
          )}
        >
          {emptyLabel}
        </div>
        <div
          className={cn(
            'w-full truncate font-medium text-neutral-400 dark:text-neutral-500',
            codeTextClassName,
            codeClassName,
          )}
        >
          -
        </div>
      </div>
    );
  }

  const imageUrl = resolveNodeImageUrl(node, imageResolver);
  const cardClassName = cn(
    'group flex flex-col items-center border bg-white text-center shadow-sm transition dark:bg-neutral-900/85',
    shellClassName,
    highlight
      ? 'border-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_8px_20px_rgba(245,158,11,0.22)] dark:border-amber-400/80 dark:shadow-[0_0_0_1px_rgba(251,191,36,0.34),0_14px_30px_rgba(0,0,0,0.34)]'
      : 'border-neutral-200 hover:border-amber-400 hover:shadow-md dark:border-white/12 dark:hover:border-amber-400/70 dark:hover:shadow-[0_14px_28px_rgba(0,0,0,0.34)]',
    className,
  );

  const content = (
    <>
      <div
        className={cn(
          'aspect-square w-full overflow-hidden border border-neutral-200 bg-neutral-50 dark:border-white/12 dark:bg-neutral-950/90',
          imageFrameClassName,
        )}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={node.code}
            className={cn(
              'h-full w-full',
              imageFit === 'contain'
                ? isLarge
                  ? 'object-contain p-1.5'
                  : 'object-contain p-1'
                : 'object-cover',
            )}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-900 dark:to-neutral-800">
            <span className={cn('text-neutral-400 dark:text-neutral-500', emptyTextClassName)}>
              暂无图
            </span>
          </div>
        )}
      </div>
      <div
        className={cn(
          'w-full truncate font-medium text-neutral-700 dark:text-neutral-100',
          codeTextClassName,
          codeClassName,
        )}
      >
        {node.code}
      </div>
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
