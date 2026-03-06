import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildInteractivePillClass } from '@/components/ui/pill';

interface StudioStepButtonProps {
  index: number;
  active: boolean;
  complete: boolean;
  title: string;
  note: string;
  onClick: () => void;
}

export function StudioStepButton({
  index,
  active,
  complete,
  title,
  note,
  onClick
}: StudioStepButtonProps) {
  return (
    <button
      type="button"
      aria-label={`${title}，${note}`}
      onClick={onClick}
      className={buildInteractivePillClass(active, {
        baseClassName:
          'flex h-11 min-w-[74px] flex-none items-center justify-between gap-2 rounded-full border px-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-2',
        activeClassName: 'border-neutral-900 bg-neutral-900 text-white shadow-[0_14px_32px_rgba(15,23,42,0.18)]',
        idleClassName: complete
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300'
          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
      })}
    >
      <div className="min-w-0">
        <span className={cn('block text-[10px] font-semibold uppercase tracking-[0.18em]', active ? 'text-white/60' : complete ? 'text-emerald-700' : 'text-neutral-400')}>
          {String(index).padStart(2, '0')}
        </span>
        <span className="block truncate text-sm font-semibold leading-none">{title}</span>
      </div>
      {complete ? <CheckCircle2 size={15} className={active ? 'text-white' : 'text-emerald-600'} /> : null}
    </button>
  );
}
