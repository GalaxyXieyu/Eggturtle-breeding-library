import { cn } from '@/lib/utils';

export const FILTER_PILL_BASE_CLASS =
  'filter-pill inline-flex h-8 items-center justify-center rounded-full border px-3 text-xs font-medium shadow-[0_1px_0_rgba(0,0,0,0.04)] transition lg:h-9 lg:px-4 lg:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] dark:focus-visible:ring-[#FFD400]/60 dark:focus-visible:ring-offset-neutral-950';

export const FILTER_PILL_ACTIVE_CLASS =
  'border-[#FFD400] bg-white text-neutral-950 font-semibold shadow-[0_6px_20px_rgba(255,212,0,0.22)] dark:border-[#FFD400] dark:bg-neutral-950 dark:text-neutral-50 dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]';

export const FILTER_PILL_IDLE_CLASS =
  'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:shadow-sm dark:border-white/12 dark:bg-white/[0.06] dark:text-neutral-200 dark:hover:border-white/22 dark:hover:bg-white/[0.1] dark:hover:text-white';

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
