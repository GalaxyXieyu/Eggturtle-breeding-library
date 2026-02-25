import type { NeedMatingStatus } from '@/types/turtleAlbum';
import { parseIsoDate } from '@/utils/dateFormat';

// Keep thresholds consistent with backend _compute_need_mating_status.
const NEED_MATING_DAYS = 10;
const WARNING_DAYS = 25;

export function daysSinceDateDay(now: Date, dt: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = new Date(now.toDateString()).getTime();
  const b = new Date(dt.toDateString()).getTime();
  return Math.floor((a - b) / msPerDay);
}

export function computeNeedMatingStatusFromIso(now: Date, lastEggAtIso?: string | null, lastMatingAtIso?: string | null) {
  const egg = parseIsoDate(lastEggAtIso || null);
  if (!egg) return { status: 'normal' as NeedMatingStatus, daysSinceEgg: null as number | null };

  const days = daysSinceDateDay(now, egg);

  const mating = parseIsoDate(lastMatingAtIso || null);
  // Same-day mating counts as cleared (compare by date, not wall-clock time).
  if (mating) {
    const matingDay = new Date(mating.toDateString()).getTime();
    const eggDay = new Date(egg.toDateString()).getTime();
    if (matingDay >= eggDay) {
      return { status: 'normal' as NeedMatingStatus, daysSinceEgg: days };
    }
  }
  if (days >= WARNING_DAYS) return { status: 'warning' as NeedMatingStatus, daysSinceEgg: days };
  if (days >= NEED_MATING_DAYS) return { status: 'need_mating' as NeedMatingStatus, daysSinceEgg: days };
  return { status: 'normal' as NeedMatingStatus, daysSinceEgg: days };
}

export function needMatingLabel(status: NeedMatingStatus) {
  if (status === 'warning') return '⚠️逾期未交配';
  if (status === 'need_mating') return '待配';
  return '正常';
}
