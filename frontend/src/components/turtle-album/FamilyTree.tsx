import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { createImageUrl } from '@/lib/api';
import { turtleAlbumService } from '@/services/turtleAlbumService';
import type { FamilyTree, FamilyTreeNode, MaleMateLoadItem } from '@/types/turtleAlbum';

interface FamilyTreeProps {
  familyTree: FamilyTree;
  mate?: { id?: string | null; code?: string | null; thumbnailUrl?: string | null } | null;
}

interface TreeNodeProps {
  node: FamilyTreeNode | null | undefined;
  showSiblings?: boolean;
  onToggleSiblings?: () => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, showSiblings, onToggleSiblings }) => {
  if (!node) {
    return (
      <div className="flex h-24 w-20 items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-400">
        未知
      </div>
    );
  }

  return (
    <div className="relative">
      <Link
        to={`/breeder/${node.id}`}
        className="group block h-24 w-20 overflow-hidden rounded-lg border-2 border-neutral-200 bg-white shadow-sm transition hover:border-amber-400 hover:shadow-md"
      >
        {node.thumbnailUrl ? (
          <img
            src={createImageUrl(node.thumbnailUrl)}
            alt={node.code}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
            <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-1">
          <div className="truncate text-[10px] font-medium text-white">{node.code}</div>
        </div>
      </Link>

      {node.siblings && node.siblings.length > 0 && (
        <button
          type="button"
          onClick={onToggleSiblings}
          className="absolute -bottom-7 left-1/2 z-10 -translate-x-1/2 rounded-full bg-neutral-200 px-2.5 py-0.5 text-[10px] font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-300"
        >
          {showSiblings ? '隐藏' : `+${node.siblings.length}`}
        </button>
      )}
    </div>
  );
};

const FamilyTreeComponent: React.FC<FamilyTreeProps> = ({ familyTree, mate }) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [showFatherSiblings, setShowFatherSiblings] = React.useState(false);
  const [showMotherSiblings, setShowMotherSiblings] = React.useState(false);
  const [showCurrentSiblings, setShowCurrentSiblings] = React.useState(false);
  const [showGreatGrandparents, setShowGreatGrandparents] = React.useState(false);
  const [showGrandparents, setShowGrandparents] = React.useState(true);
  const [showParents, setShowParents] = React.useState(true);

  // Auto-scroll to rightmost (current animal) on mount
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, []);

  const { current, ancestors, offspring, siblings } = familyTree;

  const mateCode = (mate?.code ?? familyTree.currentMate?.code ?? '').trim();
  const mateId = mate?.id ?? familyTree.currentMate?.id ?? null;
  const mateThumbnailUrl = typeof mate?.thumbnailUrl === 'string' ? mate.thumbnailUrl.trim() : '';
  const showMateNode = current.sex === 'female' && !!mateCode;

  const maleMateLoadQ = useQuery({
    queryKey: ['turtle-album', 'breeder', current.id, 'mate-load'],
    queryFn: () => turtleAlbumService.getBreederMateLoad(current.id),
    enabled: current.sex === 'male' && !!current.id,
  });

  const maleMates: MaleMateLoadItem[] = maleMateLoadQ.data?.items || [];
  const mateThumbLimit = 8;
  const mateThumbItems = maleMates.slice(0, mateThumbLimit);
  const mateMoreCount = Math.max(0, maleMates.length - mateThumbItems.length);

  // Check if there are any great-grandparents
  const hasGreatGrandparents = !!(
    ancestors.paternalPaternalGreatGrandfather ||
    ancestors.paternalPaternalGreatGrandmother ||
    ancestors.paternalMaternalGreatGrandfather ||
    ancestors.paternalMaternalGreatGrandmother ||
    ancestors.maternalPaternalGreatGrandfather ||
    ancestors.maternalPaternalGreatGrandmother ||
    ancestors.maternalMaternalGreatGrandfather ||
    ancestors.maternalMaternalGreatGrandmother
  );

  // Check if there are any grandparents
  const hasGrandparents = !!(
    ancestors.paternalGrandfather ||
    ancestors.paternalGrandmother ||
    ancestors.maternalGrandfather ||
    ancestors.maternalGrandmother
  );

  // Check if there are any parents
  const hasParents = !!(ancestors.father || ancestors.mother);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-hidden pb-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="inline-flex gap-8 px-4 py-6">
          {/* Great-grandparents column - collapsible */}
          {showGreatGrandparents && (
            <div className="flex flex-col gap-4">
              <div className="text-center text-xs font-medium text-neutral-500">曾祖辈</div>
              <div className="flex flex-col gap-3">
                <TreeNode node={ancestors.paternalPaternalGreatGrandfather} />
                <TreeNode node={ancestors.paternalPaternalGreatGrandmother} />
                <TreeNode node={ancestors.paternalMaternalGreatGrandfather} />
                <TreeNode node={ancestors.paternalMaternalGreatGrandmother} />
                <TreeNode node={ancestors.maternalPaternalGreatGrandfather} />
                <TreeNode node={ancestors.maternalPaternalGreatGrandmother} />
                <TreeNode node={ancestors.maternalMaternalGreatGrandfather} />
                <TreeNode node={ancestors.maternalMaternalGreatGrandmother} />
              </div>
            </div>
          )}

          {/* Grandparents column */}
          {hasGrandparents && showGrandparents && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGrandparents(false)}
                  className="rounded-full bg-neutral-200 p-1 text-neutral-600 transition hover:bg-neutral-300"
                  title="隐藏祖辈"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {hasGreatGrandparents && (
                  <button
                    type="button"
                    onClick={() => setShowGreatGrandparents(!showGreatGrandparents)}
                    className="rounded-full bg-neutral-200 p-1 text-neutral-600 transition hover:bg-neutral-300"
                    title={showGreatGrandparents ? '隐藏曾祖辈' : '显示曾祖辈'}
                  >
                    <svg
                      className={`h-3 w-3 transition-transform ${showGreatGrandparents ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <div className="text-center text-xs font-medium text-neutral-500">祖辈</div>
              </div>
              <div className="flex flex-col gap-3">
                <TreeNode node={ancestors.paternalGrandfather} />
                <TreeNode node={ancestors.paternalGrandmother} />
                <TreeNode node={ancestors.maternalGrandfather} />
                <TreeNode node={ancestors.maternalGrandmother} />
              </div>
            </div>
          )}

          {/* Parents column */}
          {hasParents && showParents && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowParents(false)}
                  className="rounded-full bg-neutral-200 p-1 text-neutral-600 transition hover:bg-neutral-300"
                  title="隐藏父母辈"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="text-center text-xs font-medium text-neutral-500">父母辈</div>
              </div>
            <div className="flex flex-col gap-10">
              <div>
                <TreeNode
                  node={ancestors.father}
                  showSiblings={showFatherSiblings}
                  onToggleSiblings={() => setShowFatherSiblings(!showFatherSiblings)}
                />
                {showFatherSiblings && ancestors.father?.siblings && (
                  <div className="mt-2 flex flex-col gap-2">
                    {ancestors.father.siblings.map((sibling) => (
                      <TreeNode key={sibling.id} node={sibling} />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <TreeNode
                  node={ancestors.mother}
                  showSiblings={showMotherSiblings}
                  onToggleSiblings={() => setShowMotherSiblings(!showMotherSiblings)}
                />
                {showMotherSiblings && ancestors.mother?.siblings && (
                  <div className="mt-2 flex flex-col gap-2">
                    {ancestors.mother.siblings.map((sibling) => (
                      <TreeNode key={sibling.id} node={sibling} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Current animal column */}
          <div className="flex flex-col gap-4">
            <div className="text-center text-xs font-medium text-amber-600">当前</div>

            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-amber-400 to-orange-400 opacity-75 blur"></div>
                <div className="relative">
                  <TreeNode node={current} />
                </div>
              </div>

              {showMateNode ? (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="h-3 w-px bg-neutral-300" />
                  {mateThumbnailUrl ? (
                    mateId ? (
                      <Link
                        to={`/breeder/${mateId}`}
                        title={`配偶 ${mateCode}`}
                        className="group block w-20 overflow-hidden rounded-lg border-2 border-amber-200 bg-amber-50/70 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1"
                      >
                        <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
                          <img
                            src={createImageUrl(mateThumbnailUrl)}
                            alt={mateCode}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 ring-1 ring-inset ring-black/5" />
                        </div>
                        <div className="px-1 py-1 text-center">
                          <div className="tracking-wide text-[10px] font-semibold text-amber-700">配偶</div>
                          <div className="max-w-full truncate text-[11px] font-bold text-amber-900">{mateCode}</div>
                        </div>
                      </Link>
                    ) : (
                      <div
                        title={`配偶 ${mateCode}（未找到详情）`}
                        className="w-20 cursor-not-allowed overflow-hidden rounded-lg border-2 border-amber-200 bg-amber-50/70 text-center opacity-60 shadow-sm"
                      >
                        <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
                          <img
                            src={createImageUrl(mateThumbnailUrl)}
                            alt={mateCode}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 ring-1 ring-inset ring-black/5" />
                        </div>
                        <div className="px-1 py-1">
                          <div className="tracking-wide text-[10px] font-semibold text-amber-700">配偶</div>
                          <div className="max-w-full truncate text-[11px] font-bold text-amber-900">{mateCode}</div>
                        </div>
                      </div>
                    )
                  ) : mateId ? (
                    <Link
                      to={`/breeder/${mateId}`}
                      title={`配偶 ${mateCode}`}
                      className="flex h-12 w-20 flex-col items-center justify-center rounded-lg border-2 border-amber-200 bg-amber-50/70 px-1 text-[10px] font-semibold text-amber-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1"
                    >
                      <span className="tracking-wide text-amber-700">配偶</span>
                      <span className="max-w-full truncate text-[11px] font-bold text-amber-900">{mateCode}</span>
                    </Link>
                  ) : (
                    <span
                      title={`配偶 ${mateCode}（未找到详情）`}
                      className="flex h-12 w-20 cursor-not-allowed flex-col items-center justify-center rounded-lg border-2 border-amber-200 bg-amber-50/70 px-1 text-[10px] font-semibold text-amber-800 opacity-60 shadow-sm"
                    >
                      <span className="tracking-wide text-amber-700">配偶</span>
                      <span className="max-w-full truncate text-[11px] font-bold text-amber-900">{mateCode}</span>
                    </span>
                  )}
                </div>
              ) : null}

              {current.sex === 'male' ? (
                maleMateLoadQ.isLoading ? (
                  <div className="mt-2 text-[11px] font-medium text-neutral-400">加载配偶母龟...</div>
                ) : mateThumbItems.length > 0 ? (
                  <div className="mt-2 w-64">
                    <div className="text-center text-[11px] font-medium text-neutral-500">配偶母龟</div>
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                      {mateThumbItems.map((it) => {
                        const imgUrl = (it.femaleMainImageUrl || '').trim();
                        return (
                          <Link
                            key={it.femaleId}
                            to={`/breeder/${it.femaleId}`}
                            title={it.femaleCode}
                            className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition hover:border-amber-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1"
                          >
                            {imgUrl ? (
                              <img
                                src={createImageUrl(imgUrl)}
                                alt={it.femaleCode}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
                                <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5">
                              <div className="truncate text-[10px] font-medium text-white">{it.femaleCode}</div>
                            </div>
                          </Link>
                        );
                      })}
                      {mateMoreCount > 0 ? (
                        <div
                          title={`还有 ${mateMoreCount} 只`}
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600"
                        >
                          +{mateMoreCount}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null
              ) : null}
            </div>
          </div>

          {/* Offspring column */}
          {offspring.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="text-center text-xs font-medium text-neutral-500">子代</div>
              <div className="flex flex-col gap-3">
                {offspring.map((child) => (
                  <TreeNode key={child.id} node={child} />
                ))}
                {showCurrentSiblings && siblings.length > 0 && (
                  <div className="mt-4 border-t border-neutral-200 pt-3">
                    <div className="mb-2 text-center text-[10px] text-neutral-400">同辈</div>
                    {siblings.map((sibling) => (
                      <div key={sibling.id} className="mb-2">
                        <TreeNode node={sibling} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {siblings.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCurrentSiblings(!showCurrentSiblings)}
                  className="mt-2 rounded-full bg-neutral-200 px-2.5 py-0.5 text-[10px] font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-300"
                >
                  {showCurrentSiblings ? '隐藏' : `+${siblings.length}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center">
        <div className="rounded-t-lg bg-black/60 px-4 py-2 text-xs text-white backdrop-blur-sm">
          ← 左滑查看祖辈 | 右滑查看后代 →
        </div>
      </div>
    </div>
  );
};

export default FamilyTreeComponent;
