import { cn } from '../../lib/utils';

export const INTERACTIVE_PILL_BASE_CLASS =
  'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export const INTERACTIVE_PILL_ACTIVE_CLASS =
  'border-[#FFD400]/70 bg-[#FFD400] text-neutral-900 shadow-[0_6px_16px_rgba(255,212,0,0.28)]';

export const INTERACTIVE_PILL_IDLE_CLASS =
  'border-neutral-200 bg-white text-neutral-700 hover:border-[#FFD400]/60 hover:text-neutral-900';

type BuildInteractivePillClassOptions = {
  baseClassName?: string;
  activeClassName?: string;
  idleClassName?: string;
  className?: string;
};

export function buildInteractivePillClass(
  active: boolean,
  options?: BuildInteractivePillClassOptions
) {
  return cn(
    options?.baseClassName ?? INTERACTIVE_PILL_BASE_CLASS,
    active
      ? options?.activeClassName ?? INTERACTIVE_PILL_ACTIVE_CLASS
      : options?.idleClassName ?? INTERACTIVE_PILL_IDLE_CLASS,
    options?.className
  );
}
