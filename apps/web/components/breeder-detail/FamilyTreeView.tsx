import { type ProductFamilyTree } from '@eggturtle/shared';
import { Network } from 'lucide-react';
import { formatSex } from '@/lib/pet-format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TreeCard } from './TreeCard';

type FamilyTreeViewProps = {
  tree: ProductFamilyTree;
  openBreederDetail: (id: string) => void;
};

export function FamilyTreeView({ tree, openBreederDetail }: FamilyTreeViewProps) {
  return (
    <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Network size={18} />
          家族谱系
        </CardTitle>
        <CardDescription>{tree.limitations}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/75">
          <div className="overflow-x-auto overflow-y-hidden pb-4">
            <div className="inline-flex gap-8 px-4 py-6">
              <div className="flex flex-col gap-3">
                <div className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">父本 / 母本</div>
                <TreeCard title="父本" node={tree.sire} onOpen={openBreederDetail} />
                <TreeCard title="母本" node={tree.dam} onOpen={openBreederDetail} />
              </div>

              <div className="flex flex-col gap-3">
                <div className="text-center text-xs font-medium text-amber-600 dark:text-amber-400">当前个体 / 配偶</div>
                <TreeCard title="当前个体" node={tree.self} onOpen={openBreederDetail} highlight />
                <TreeCard title="配偶" node={tree.mate} onOpen={openBreederDetail} />
              </div>

              <div className="flex flex-col gap-3">
                <div className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">子代</div>
                {tree.children.length === 0 ? (
                  <TreeCard title="子代" node={null} onOpen={openBreederDetail} />
                ) : (
                  tree.children.map((child) => (
                    <TreeCard
                      key={child.id}
                      title={formatSex(child.sex, { unknownLabel: 'unknown' })}
                      node={child}
                      onOpen={openBreederDetail}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex justify-center">
            <div className="rounded-t-lg bg-black/60 px-4 py-1.5 text-[11px] text-white backdrop-blur-sm">左右滑动查看完整谱系</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
