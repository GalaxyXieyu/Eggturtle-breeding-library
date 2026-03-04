import { cn } from '../lib/utils';

export const FILTER_PILL_BASE_CLASS =
  'h-8 rounded-full border px-3 text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] transition lg:h-9 lg:px-4 lg:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 active:scale-[0.98]';

export const FILTER_PILL_ACTIVE_CLASS =
  'border-[#FFD400] bg-[#FFD400] text-neutral-900 font-semibold shadow-[0_6px_20px_rgba(255,212,0,0.22)]';

export const FILTER_PILL_IDLE_CLASS =
  'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:shadow-sm';

type BuildFilterPillClassOptions = {
  className?: string;
  activeClassName?: string;
  idleClassName?: string;
};

export function buildFilterPillClass(selected: boolean, options?: BuildFilterPillClassOptions) {
  return cn(
    FILTER_PILL_BASE_CLASS,
    selected ? options?.activeClassName ?? FILTER_PILL_ACTIVE_CLASS : options?.idleClassName ?? FILTER_PILL_IDLE_CLASS,
    options?.className,
  );
}
