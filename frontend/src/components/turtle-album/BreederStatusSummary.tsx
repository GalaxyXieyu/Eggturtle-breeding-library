import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { turtleAlbumService } from '@/services/turtleAlbumService';
import { formatMmDd } from '@/utils/dateFormat';
import { computeNeedMatingStatusFromIso, needMatingLabel } from '@/utils/needMatingStatus';

function statusBadge(status: 'normal' | 'need_mating' | 'warning', daysSinceEgg: number | null) {
  if (status === 'warning') {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
        {needMatingLabel(status)}{daysSinceEgg !== null ? ` ${daysSinceEgg}天` : ''}
      </span>
    );
  }
  if (status === 'need_mating') {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
        {needMatingLabel(status)}{daysSinceEgg !== null ? ` ${daysSinceEgg}天` : ''}
      </span>
    );
  }
  // normal should not prompt.
  return null;
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
  const computed = computeNeedMatingStatusFromIso(new Date(), lastEgg, lastMating);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-700">
      {statusBadge(computed.status, computed.daysSinceEgg)}
      <span className="text-neutral-500">最近产蛋</span>
      <span className="font-mono">{formatMmDd(lastEgg)}</span>
      <span className="text-neutral-300">·</span>
      <span className="text-neutral-500">最近交配</span>
      <span className="font-mono">{formatMmDd(lastMating)}</span>
    </div>
  );
}
