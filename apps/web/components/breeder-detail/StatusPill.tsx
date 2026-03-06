import { cn } from '@/lib/utils';

type StatusPillProps = {
  label: string;
  ok: boolean;
};

export function StatusPill({ label, ok }: StatusPillProps) {
  return (
    <div
      className={cn(
        'rounded-xl border px-2.5 py-2 text-center font-semibold',
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-neutral-200 bg-white text-neutral-500'
      )}
    >
      {label}: {ok ? '通过' : '未满足'}
    </div>
  );
}
