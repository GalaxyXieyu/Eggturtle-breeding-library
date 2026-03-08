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
  emptyLabel?: string;
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
  emptyLabel = '未知',
  imageResolver
}: FamilyNodeCardProps) {
  if (!node) {
    return (
      <div
        className={cn(
          'flex h-24 w-20 items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-400',
          className
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  const imageUrl = resolveNodeImageUrl(node, imageResolver);
  const cardClassName = cn(
    'group relative block h-24 w-20 overflow-hidden rounded-lg border-2 bg-white shadow-sm transition',
    highlight
      ? 'border-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_8px_20px_rgba(245,158,11,0.3)]'
      : 'border-neutral-200 hover:border-amber-400 hover:shadow-md',
    className
  );

  const content = (
    <>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={node.code}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
          <span className="text-xs text-neutral-400">暂无图</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-1">
        <div className="truncate text-[10px] font-medium text-white">{node.code}</div>
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
