import Image from 'next/image';
import { type ProductFamilyTree } from '@eggturtle/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type FamilyTreeNode = ProductFamilyTree['self'] | ProductFamilyTree['children'][number];

type TreeCardProps = {
  title: string;
  node: FamilyTreeNode | null;
  onOpen: (id: string) => void;
  highlight?: boolean;
};

export function TreeCard(props: TreeCardProps) {
  const node = props.node;

  return (
    <div
      className={cn(
        'w-28 overflow-hidden rounded-2xl border bg-white shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] dark:bg-neutral-900/70',
        props.highlight
          ? 'border-amber-300 ring-2 ring-amber-200/70 dark:border-amber-400/80 dark:ring-amber-400/20'
          : 'border-neutral-200/90 dark:border-white/10'
      )}
    >
      <div className="p-3 pb-0">
        <p className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 dark:text-neutral-400">{props.title}</p>
      </div>
      {node ? (
        <>
          <div className="mt-2 px-3">
            {node.coverImageUrl ? (
              <Image
                src={node.coverImageUrl}
                alt={node.name ?? node.code}
                width={112}
                height={96}
                className="h-24 w-full rounded-xl object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-24 w-full items-center justify-center rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-200 text-[11px] text-neutral-400 dark:from-neutral-800 dark:to-neutral-900 dark:text-neutral-500">
                暂无图
              </div>
            )}
          </div>
          <div className="space-y-1.5 p-3">
            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{node.code}</p>
            <p className="line-clamp-2 min-h-8 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">{node.name ?? '未命名种龟'}</p>
            <div className="pt-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 rounded-full border border-neutral-200 px-2.5 text-[11px] font-semibold dark:border-white/10 dark:bg-neutral-950/35 dark:text-neutral-100"
                onClick={() => props.onOpen(node.id)}
              >
                打开
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="p-3 pt-4 text-xs text-neutral-500 dark:text-neutral-400">未关联</p>
      )}
    </div>
  );
}
