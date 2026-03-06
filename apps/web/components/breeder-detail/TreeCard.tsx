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
        'w-28 rounded-2xl border bg-white p-3 shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] dark:bg-neutral-900/70',
        props.highlight
          ? 'border-amber-300 ring-2 ring-amber-200/70 dark:border-amber-400/80 dark:ring-amber-400/20'
          : 'border-neutral-200/90 dark:border-white/10'
      )}
    >
      <p className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 dark:text-neutral-400">{props.title}</p>
      {node ? (
        <div className="mt-2 space-y-1.5">
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
      ) : (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">未关联</p>
      )}
    </div>
  );
}
