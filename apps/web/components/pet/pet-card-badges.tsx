import { formatPrice, formatSex, formatShortDate } from '@/lib/pet-format';
import { cn } from '@/lib/utils';

export type PetNeedMatingStatus = 'normal' | 'need_mating' | 'warning';

export function PetStatusBadge({
  status,
  daysSinceEgg,
  className,
}: {
  status?: PetNeedMatingStatus | null;
  daysSinceEgg?: number | null;
  className?: string;
}) {
  if (status === 'need_mating') {
    return (
      <span
        className={cn(
          'rounded-full bg-[#FFD400]/90 px-2.5 py-1 text-xs font-medium text-black ring-1 ring-black/10',
          className,
        )}
      >
        待配{typeof daysSinceEgg === 'number' ? ` 第${daysSinceEgg}天` : ''}
      </span>
    );
  }

  if (status === 'warning') {
    return (
      <span
        className={cn(
          'rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-black/10',
          className,
        )}
      >
        ⚠️逾期未交配{typeof daysSinceEgg === 'number' ? ` 第${daysSinceEgg}天` : ''}
      </span>
    );
  }

  return null;
}

export function PetSexBadge({
  sex,
  emptyLabel = '未知',
  unknownLabel = emptyLabel,
  className,
}: {
  sex?: string | null;
  emptyLabel?: string;
  unknownLabel?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'rounded-full bg-white/90 px-2.5 py-1 text-xs text-black dark:bg-neutral-100 dark:text-neutral-900',
        className,
      )}
    >
      {formatSex(sex, { emptyLabel, unknownLabel })}
    </span>
  );
}

export function PetPriceBadge({
  price,
  label = '子代 ¥',
  className,
}: {
  price?: number | null;
  label?: string;
  className?: string;
}) {
  if (typeof price !== 'number') {
    return null;
  }

  return (
    <span
      className={cn(
        'shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold leading-5 text-[#FFD400] ring-1 ring-white/10 sm:text-xs',
        className,
      )}
    >
      {label} {formatPrice(price)}
    </span>
  );
}

export function PetTimelineChips({
  lastEggAt,
  lastMatingAt,
  className,
}: {
  lastEggAt?: string | null;
  lastMatingAt?: string | null;
  className?: string;
}) {
  if (!lastEggAt && !lastMatingAt) {
    return null;
  }

  return (
    <div
      className={cn(
        'mt-2 flex flex-wrap gap-1.5 text-[11px] text-neutral-700 dark:text-neutral-200',
        className,
      )}
    >
      {lastEggAt ? (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 ring-1 ring-amber-200/60 dark:bg-amber-500/12 dark:ring-amber-400/20">
          产蛋 {formatShortDate(lastEggAt)}
        </span>
      ) : null}
      {lastMatingAt ? (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 ring-1 ring-emerald-200/60 dark:bg-emerald-500/12 dark:ring-emerald-400/20">
          交配 {formatShortDate(lastMatingAt)}
        </span>
      ) : null}
    </div>
  );
}
