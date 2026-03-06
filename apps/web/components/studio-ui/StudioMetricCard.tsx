import { cn } from '@/lib/utils';

interface StudioMetricCardProps {
  eyebrow: string;
  title: string;
  note: string;
  icon?: JSX.Element;
  tone?: 'stone' | 'sun' | 'ink';
}

export function StudioMetricCard({
  eyebrow,
  title,
  note,
  icon,
  tone = 'stone'
}: StudioMetricCardProps) {
  return (
    <div
      className={cn(
        'rounded-[26px] border p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]',
        tone === 'sun' && 'border-[#ecd7a1] bg-[#fff7db]',
        tone === 'ink' && 'border-neutral-900 bg-neutral-900 text-white',
        tone === 'stone' && 'border-neutral-200 bg-white'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn('text-[11px] font-semibold uppercase tracking-[0.22em]', tone === 'ink' ? 'text-white/55' : 'text-neutral-500')}>
            {eyebrow}
          </p>
          <p className={cn('mt-2 text-xl font-semibold leading-tight', tone === 'ink' ? 'text-white' : 'text-neutral-950')}>
            {title}
          </p>
        </div>
        {icon ? (
          <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full', tone === 'ink' ? 'bg-white/10 text-white' : 'bg-white/80 text-neutral-700 shadow-sm')}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className={cn('mt-3 text-sm leading-6', tone === 'ink' ? 'text-white/70' : 'text-neutral-500')}>{note}</p>
    </div>
  );
}
