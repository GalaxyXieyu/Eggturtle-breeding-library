import { type ProductFamilyTree } from '@eggturtle/shared';
import { Square } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { TreeCard } from './TreeCard';

type FamilyTreeViewProps = {
  tree: ProductFamilyTree;
  openBreederDetail: (id: string) => void;
};

export function FamilyTreeView({ tree, openBreederDetail }: FamilyTreeViewProps) {
  return (
    <Card className="rounded-3xl border-black/5 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Square size={16} className="text-neutral-700" />
        <h2 className="text-3xl font-semibold text-neutral-900">家族谱系</h2>
      </div>
      {tree.limitations ? <p className="mb-4 text-xs text-neutral-500">{tree.limitations}</p> : null}

      <div className="rounded-3xl border border-neutral-200 bg-neutral-50/35 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[11px] text-neutral-600">×</span>
              <span>父母辈</span>
            </div>
            <div className="space-y-3">
              <TreeCard node={tree.sire} onOpen={openBreederDetail} />
              <TreeCard node={tree.dam} onOpen={openBreederDetail} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-amber-600">当前</div>
            <TreeCard node={tree.self} onOpen={openBreederDetail} highlight />
            <div className="space-y-1">
              <TreeCard node={tree.mate} onOpen={openBreederDetail} />
              {tree.mate ? <p className="text-center text-xs font-semibold text-amber-700">配偶</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-neutral-200 pt-3">
          <p className="mb-2 text-xs font-medium text-neutral-500">子代</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tree.children.length === 0 ? (
              <TreeCard node={null} onOpen={openBreederDetail} className="h-20 w-16 shrink-0" />
            ) : (
              tree.children.map((child) => (
                <TreeCard key={child.id} node={child} onOpen={openBreederDetail} className="h-20 w-16 shrink-0" />
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
