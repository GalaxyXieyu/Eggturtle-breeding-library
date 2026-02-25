import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { turtleAlbumService } from '@/services/turtleAlbumService';
import type { MaleMateLoadItem, NeedMatingStatus } from '@/types/turtleAlbum';
import { formatMmDd } from '@/utils/dateFormat';

function statusBadge(status: NeedMatingStatus) {
  if (status === 'warning') {
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">警告</span>;
  }
  if (status === 'need_mating') {
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">需交配</span>;
  }
  return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">正常</span>;
}

function rowSortKey(it: MaleMateLoadItem) {
  const severity = it.status === 'warning' ? 2 : it.status === 'need_mating' ? 1 : 0;
  return `${severity}-${it.lastEggAt || ''}-${it.femaleCode}`;
}

type Props = {
  maleBreederId: string;
};

export default function MaleMateLoadCard({ maleBreederId }: Props) {
  const q = useQuery({
    queryKey: ['turtle-album', 'breeder', maleBreederId, 'mate-load'],
    queryFn: () => turtleAlbumService.getBreederMateLoad(maleBreederId),
    enabled: !!maleBreederId,
  });

  if (q.isLoading) {
    return (
      <div className="mt-8 px-1 sm:px-3 lg:px-5 2xl:px-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">加载关联母龟中...</div>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="mt-8 px-1 sm:px-3 lg:px-5 2xl:px-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">{(q.error as Error).message}</div>
      </div>
    );
  }

  const data = q.data;
  const items = (data?.items || []).slice().sort((a, b) => (rowSortKey(b) > rowSortKey(a) ? 1 : -1));

  return (
    <div className="mt-8 px-1 sm:px-3 lg:px-5 2xl:px-6">
      <div className="mb-4 flex items-center gap-2">
        <svg className="h-5 w-5 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
        </svg>
        <h2 className="text-lg font-semibold text-neutral-900">关联母龟（配偶/负载）</h2>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">关联 {data?.totals?.relatedFemales ?? 0}</span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">需交配 {data?.totals?.needMating ?? 0}</span>
        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">警告 {data?.totals?.warning ?? 0}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
        {items.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">暂无关联母龟</div>
        ) : (
          <div className="divide-y">
            {items.map((it) => (
              <div key={it.femaleId} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link to={`/breeder/${it.femaleId}`} className="truncate text-sm font-semibold text-neutral-900 hover:underline">
                      {it.femaleCode}
                    </Link>
                    {statusBadge(it.status)}
                  </div>

                  <div className="flex items-center gap-3 text-xs font-medium text-neutral-600">
                    <span>最近产蛋 {formatMmDd(it.lastEggAt)}</span>
                    <span className="text-neutral-300">·</span>
                    <span>最近与本公交配 {formatMmDd(it.lastMatingWithThisMaleAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
