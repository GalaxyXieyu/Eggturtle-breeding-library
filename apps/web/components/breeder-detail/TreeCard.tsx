import { type ProductFamilyTree } from '@eggturtle/shared';
import { resolveAuthenticatedAssetUrl } from '@/lib/api-client';
import { FamilyNodeCard } from '@/components/family-tree/FamilyNodeCard';

type FamilyTreeNode = ProductFamilyTree['self'] | ProductFamilyTree['children'][number];

type TreeCardProps = {
  node: FamilyTreeNode | null;
  onOpen: (id: string) => void;
  highlight?: boolean;
  className?: string;
};

export function TreeCard({ node, onOpen, highlight = false, className }: TreeCardProps) {
  return (
    <FamilyNodeCard
      node={node}
      onOpen={onOpen}
      highlight={highlight}
      className={className}
      codeClassName="px-0.5 text-[10px] leading-3"
      imageFit="contain"
      imageResolver={resolveAuthenticatedAssetUrl}
    />
  );
}
