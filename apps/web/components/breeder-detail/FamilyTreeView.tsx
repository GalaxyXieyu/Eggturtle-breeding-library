import { type ProductFamilyTree } from '@eggturtle/shared';
import { Square } from 'lucide-react';
import { PetStatusBadge } from '@/components/pet';
import { Card } from '@/components/ui/card';
import { TreeCard } from './TreeCard';

type FamilyTreeViewProps = {
  tree: ProductFamilyTree;
  openBreederDetail: (id: string) => void;
};

type FamilyTreeMateNode = ProductFamilyTree['mates'][number];
type FamilyTreeOptionalMateNode = NonNullable<ProductFamilyTree['mate']>;
type FamilyTreeRelatedMate = FamilyTreeMateNode | FamilyTreeOptionalMateNode;

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

function isDetailedMate(mate: FamilyTreeRelatedMate): mate is FamilyTreeMateNode {
  return 'needMatingStatus' in mate || 'daysSinceEgg' in mate || 'lastEggAt' in mate || 'lastMatingAt' in mate;
}

export function FamilyTreeView({ tree, openBreederDetail }: FamilyTreeViewProps) {
  const mates = tree.mates ?? [];
  const primaryChild = tree.children[0] ?? null;
  const extraChildren = tree.children.slice(1);
  const relatedMates: FamilyTreeRelatedMate[] = mates.length > 0 ? mates : tree.mate ? [tree.mate] : [];

  return (
    <Card className="rounded-3xl border-black/5 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Square size={16} className="text-neutral-700" />
        <h2 className="text-2xl font-semibold text-neutral-900">家族谱系</h2>
      </div>
      {tree.limitations ? <p className="mb-4 text-xs text-neutral-500">{tree.limitations}</p> : null}

      <div className="space-y-4 rounded-3xl border border-neutral-200 bg-neutral-50/35 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <section className="min-w-0 flex-1 space-y-3">
            <div className="overflow-x-auto pb-1">
              <div className="grid min-w-[18rem] grid-cols-3 gap-3 rounded-2xl border border-neutral-200 bg-white/70 p-3 sm:min-w-0 sm:gap-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-600">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-neutral-200 text-[10px] text-neutral-700">1</span>
                    <span>父母辈</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <TreeCard node={tree.sire} onOpen={openBreederDetail} className="w-[5.2rem]" />
                    <TreeCard node={tree.dam} onOpen={openBreederDetail} className="w-[5.2rem]" />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-[10px] text-amber-700">2</span>
                    <span>当前</span>
                  </div>
                  <TreeCard node={tree.self} onOpen={openBreederDetail} highlight className="w-[5.5rem]" />
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-600">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-neutral-200 text-[10px] text-neutral-700">3</span>
                    <span>子代</span>
                  </div>
                  <TreeCard node={primaryChild} onOpen={openBreederDetail} className="w-[5.2rem]" />
                  {tree.children.length > 1 ? (
                    <p className="text-[10px] font-medium text-neutral-500">+{tree.children.length - 1} 只子代</p>
                  ) : null}
                </div>
              </div>
            </div>

            {extraChildren.length > 0 ? (
              <section className="space-y-2 rounded-2xl border border-neutral-200 bg-white/70 px-3 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-neutral-200 text-[10px] text-neutral-700">4</span>
                  <span>其余子代</span>
                </div>
                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-fit gap-2">
                    {extraChildren.map((child) => (
                      <TreeCard key={child.id} node={child} onOpen={openBreederDetail} className="w-[5rem] shrink-0" />
                    ))}
                  </div>
                </div>
              </section>
            ) : null}
          </section>

          <aside className="space-y-3 xl:w-[18rem] xl:shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[11px] text-neutral-600">+</span>
                <span>{mates.length > 0 ? '配偶 / 关联母龟' : '配偶'}</span>
              </div>
              {mates.length > 0 ? <span className="text-xs text-neutral-500">附加列</span> : null}
            </div>

            {relatedMates.length > 0 ? (
              <div className="space-y-2">
                {relatedMates.map((mate) => {
                  const detailedMate = isDetailedMate(mate) ? mate : null;
                  const daysSinceEgg = detailedMate?.daysSinceEgg ?? null;
                  const needMatingStatus = detailedMate?.needMatingStatus ?? null;
                  const lastEggAt = detailedMate?.lastEggAt ?? null;
                  const lastMatingAt = detailedMate?.lastMatingAt ?? null;

                  return (
                    <div
                      key={mate.id}
                      className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-2.5 py-2.5 shadow-sm"
                    >
                      <TreeCard node={mate} onOpen={openBreederDetail} className="w-[4.8rem] shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => openBreederDetail(mate.id)}
                          className="truncate text-left text-xs font-semibold text-neutral-900 hover:text-amber-700"
                        >
                          {mate.code}
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {needMatingStatus ? (
                            <PetStatusBadge status={needMatingStatus} daysSinceEgg={daysSinceEgg} />
                          ) : null}
                          {typeof daysSinceEgg === 'number' ? (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
                              待交配 {daysSinceEgg} 天
                            </span>
                          ) : null}
                        </div>
                        <div className="space-y-0.5 text-[10px] text-neutral-500">
                          <p>最近产蛋 {formatDateLabel(lastEggAt)}</p>
                          <p>最近交配 {formatDateLabel(lastMatingAt)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/80 p-2.5">
                <TreeCard node={null} onOpen={openBreederDetail} className="w-[5rem]" />
              </div>
            )}
          </aside>
        </div>
      </div>
    </Card>
  );
}
