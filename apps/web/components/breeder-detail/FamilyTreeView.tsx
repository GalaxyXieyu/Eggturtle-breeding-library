import { type ProductFamilyTree } from '@eggturtle/shared';
import { Square } from 'lucide-react';
import { PetStatusBadge } from '@/components/pet';
import { Card } from '@/components/ui/card';
import { TreeCard } from './TreeCard';

type FamilyTreeViewProps = {
  tree: ProductFamilyTree;
  openBreederDetail: (id: string) => void;
};

type FamilyTreeMateStatus = 'normal' | 'need_mating' | 'warning';
type FamilyTreeMateLike = NonNullable<ProductFamilyTree['mate']> & {
  needMatingStatus?: FamilyTreeMateStatus | null;
  lastEggAt?: string | null;
  lastMatingAt?: string | null;
  daysSinceEgg?: number | null;
};

function formatDateLabel(value?: string | null) {
  if (!value) {
    return '暂无';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '暂无';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function resolveRelatedMates(tree: ProductFamilyTree): { items: FamilyTreeMateLike[]; hasExtendedList: boolean } {
  const extendedMates = (tree as ProductFamilyTree & { mates?: FamilyTreeMateLike[] | null }).mates;
  if (Array.isArray(extendedMates) && extendedMates.length > 0) {
    return {
      items: extendedMates,
      hasExtendedList: true,
    };
  }

  if (tree.mate) {
    return {
      items: [tree.mate as FamilyTreeMateLike],
      hasExtendedList: false,
    };
  }

  return {
    items: [],
    hasExtendedList: false,
  };
}

export function FamilyTreeView({ tree, openBreederDetail }: FamilyTreeViewProps) {
  const relatedMatesState = resolveRelatedMates(tree);
  const mates = relatedMatesState.items;
  const children = tree.children;
  const childNodes = children.length > 0 ? children : [null];

  // Check if we have any grandparents
  const hasGrandparents =
    tree.paternalGrandfather ||
    tree.paternalGrandmother ||
    tree.maternalGrandfather ||
    tree.maternalGrandmother;

  const layoutClassName = hasGrandparents ? 'min-w-[32rem] grid-cols-5' : 'min-w-[20rem] grid-cols-3';

  return (
    <Card className="rounded-3xl border-black/5 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Square size={16} className="text-neutral-700" />
        <h2 className="text-2xl font-semibold text-neutral-900">家族谱系</h2>
      </div>
      {tree.limitations ? <p className="mb-4 text-xs text-neutral-500">{tree.limitations}</p> : null}

      <div className="space-y-4 rounded-3xl border border-neutral-200 bg-neutral-50/35 p-4 sm:p-5">
        <div className="overflow-x-auto pb-1">
          <div
            className={`grid items-start gap-3 rounded-2xl border border-neutral-200 bg-white/70 p-4 sm:min-w-0 sm:gap-5 ${layoutClassName}`}
          >
            {hasGrandparents ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-600">
                  <span>祖父母辈</span>
                </div>
                <div className="flex w-full flex-col items-center gap-2">
                  <div className="w-full space-y-1">
                    <p className="text-center text-[10px] font-medium text-neutral-500">父系</p>
                    <TreeCard
                      node={tree.paternalGrandfather ?? null}
                      onOpen={openBreederDetail}
                      className="w-[6rem] sm:w-[6.5rem]"
                    />
                    <TreeCard
                      node={tree.paternalGrandmother ?? null}
                      onOpen={openBreederDetail}
                      className="w-[6rem] sm:w-[6.5rem]"
                    />
                  </div>
                  <div className="w-full space-y-1">
                    <p className="text-center text-[10px] font-medium text-neutral-500">母系</p>
                    <TreeCard
                      node={tree.maternalGrandfather ?? null}
                      onOpen={openBreederDetail}
                      className="w-[6rem] sm:w-[6.5rem]"
                    />
                    <TreeCard
                      node={tree.maternalGrandmother ?? null}
                      onOpen={openBreederDetail}
                      className="w-[6rem] sm:w-[6.5rem]"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-600">
                <span>父母辈</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <TreeCard node={tree.sire} onOpen={openBreederDetail} className="w-[7rem] sm:w-[7.5rem]" />
                <TreeCard node={tree.dam} onOpen={openBreederDetail} className="w-[7rem] sm:w-[7.5rem]" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                <span>当前</span>
              </div>
              <TreeCard node={tree.self} onOpen={openBreederDetail} highlight className="w-[7.5rem] sm:w-[8rem]" />

              <div className="w-full space-y-1.5 pt-1">
                <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-neutral-500">
                  <span>{relatedMatesState.hasExtendedList ? '配偶 / 关联母龟' : '配偶'}</span>
                </div>

                {mates.length > 0 ? (
                  <div className="space-y-2">
                    {mates.map((mate) => {
                      const daysSinceEgg = mate.daysSinceEgg ?? null;
                      const needMatingStatus = mate.needMatingStatus ?? null;
                      const lastEggAt = mate.lastEggAt ?? null;
                      const lastMatingAt = mate.lastMatingAt ?? null;

                      return (
                        <div
                          key={mate.id}
                          className="flex flex-col items-center gap-1.5 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm"
                        >
                          <TreeCard node={mate} onOpen={openBreederDetail} className="w-[6.5rem] sm:w-[7rem]" />
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {needMatingStatus ? (
                              <PetStatusBadge status={needMatingStatus} daysSinceEgg={daysSinceEgg} />
                            ) : null}
                          </div>
                          <div className="space-y-0.5 text-center text-[10px] text-neutral-500">
                            <p>最近产蛋 {formatDateLabel(lastEggAt)}</p>
                            <p>最近交配 {formatDateLabel(lastMatingAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/80 p-2.5">
                    <TreeCard node={null} onOpen={openBreederDetail} className="mx-auto w-[6.5rem] sm:w-[7rem]" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-600">
                <span>子代</span>
              </div>
              <div className="flex w-full flex-col items-center gap-2">
                {childNodes.map((child, index) => (
                  <TreeCard
                    key={child?.id ?? `empty-child-${index}`}
                    node={child}
                    onOpen={openBreederDetail}
                    className="w-[6.5rem] sm:w-[7rem]"
                  />
                ))}
              </div>
              {children.length > 1 ? (
                <p className="text-[10px] font-medium text-neutral-500">共 {children.length} 只子代</p>
              ) : null}
            </div>

            {hasGrandparents ? <div aria-hidden className="hidden sm:block" /> : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
