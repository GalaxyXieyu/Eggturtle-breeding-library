import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { turtleAlbumService } from '@/services/turtleAlbumService';
import { formatMmDd, parseIsoDate } from '@/utils/dateFormat';

function computeNeedMatingStatus(now: Date, lastEggAt: string | null | undefined, lastMatingAt: string | null | undefined) {
  const egg = parseIsoDate(lastEggAt || null);
  if (!egg) return 'normal' as const;

  const mating = parseIsoDate(lastMatingAt || null);
  if (mating && mating.getTime() >= egg.getTime()) return 'normal' as const;

  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(egg.toDateString()).getTime()) / msPerDay);

  if (days >= 10) return 'warning' as const;
  return 'need_mating' as const;
}

function statusBadge(status: 'normal' | 'need_mating' | 'warning') {
  if (status === 'warning') {
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">警告</span>;
  }
  if (status === 'need_mating') {
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">需交配</span>;
  }
  return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">正常</span>;
}

type Props = {
  breederId: string;
};

export default function BreederStatusSummary({ breederId }: Props) {
  const lastEggQ = useQuery({
    queryKey: ['turtle-album', 'breeder', breederId, 'status', 'last-egg'],
    queryFn: () => turtleAlbumService.getBreederEvents(breederId, { type: 'egg', limit: 1 }),
    enabled: !!breederId,
  });

  const lastMatingQ = useQuery({
    queryKey: ['turtle-album', 'breeder', breederId, 'status', 'last-mating'],
    queryFn: () => turtleAlbumService.getBreederEvents(breederId, { type: 'mating', limit: 1 }),
    enabled: !!breederId,
  });

  const lastEgg = lastEggQ.data?.items?.[0]?.eventDate || null;
  const lastMating = lastMatingQ.data?.items?.[0]?.eventDate || null;
  const status = computeNeedMatingStatus(new Date(), lastEgg, lastMating);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-700">
      {statusBadge(status)}
      <span className="text-neutral-500">最近产蛋</span>
      <span className="font-mono">{formatMmDd(lastEgg)}</span>
      <span className="text-neutral-300">·</span>
      <span className="text-neutral-500">最近交配</span>
      <span className="font-mono">{formatMmDd(lastMating)}</span>
    </div>
  );
}
