import { type ElementType, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type MobileSettingsHeaderProps = {
  className?: string;
  description?: string;
  eyebrow?: string;
  title: string;
  titleAs?: 'h1' | 'h2';
  trailing?: ReactNode;
};

export function MobileSettingsHeader({
  className,
  description,
  eyebrow,
  title,
  titleAs = 'h1',
  trailing,
}: MobileSettingsHeaderProps) {
  const TitleTag = titleAs as ElementType;

  return (
    <header className={cn('flex items-start justify-between gap-3 px-1', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="inline-flex rounded-full border border-stone-200/80 bg-white/78 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500 shadow-sm backdrop-blur-sm">
            {eyebrow}
          </p>
        ) : null}
        <TitleTag className="mt-2 text-pretty text-[24px] font-semibold tracking-tight text-neutral-950 sm:text-[28px]">
          {title}
        </TitleTag>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{description}</p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </header>
  );
}

type MobileSettingsCardProps = {
  children: ReactNode;
  className?: string;
};

export function MobileSettingsCard({ children, className }: MobileSettingsCardProps) {
  return (
    <Card
      className={cn(
        'mobile-settings-card relative overflow-hidden rounded-[24px] border border-black/[0.05] bg-white/88 shadow-[0_12px_28px_rgba(15,23,42,0.07)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/80 supports-[backdrop-filter]:bg-white/78 supports-[backdrop-filter]:backdrop-blur-xl',
        className,
      )}
    >
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

type MobileSettingRowProps = {
  active?: boolean;
  className?: string;
  detail?: string;
  icon: ReactNode;
  label: string;
  leading?: ReactNode;
  onClick?: () => void;
  summary: string;
  trailing?: ReactNode;
};

export function MobileSettingRow({
  active = false,
  className,
  detail,
  icon,
  label,
  leading,
  onClick,
  summary,
  trailing,
}: MobileSettingRowProps) {
  const content = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-black/[0.04] bg-stone-100/88 text-neutral-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <span aria-hidden="true">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <p className="shrink-0 text-[11px] font-medium tracking-[0.03em] text-neutral-400">
            {label}
          </p>
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <p className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.015em] text-neutral-900">
            {summary}
          </p>
        </div>
        {detail ? <p className="mt-0.5 truncate text-[11px] text-neutral-400">{detail}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
      {onClick ? (
        <ChevronRight
          aria-hidden="true"
          size={16}
          className={cn('shrink-0 text-neutral-300 transition-transform duration-200', active && 'rotate-90')}
        />
      ) : null}
    </>
  );

  if (!onClick) {
    return <div className={cn('flex items-center gap-2.5 border-b border-black/[0.05] px-3.5 py-3 last:border-b-0', className)}>{content}</div>;
  }

  return (
    <button
      type="button"
      aria-expanded={active}
      className={cn(
        'flex w-full items-center gap-2.5 border-b border-black/[0.05] px-3.5 py-3 text-left transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/70 focus-visible:ring-inset last:border-b-0 hover:bg-stone-50/80 active:bg-amber-50/50',
        active ? 'bg-amber-50/35' : 'bg-transparent',
        className,
      )}
      onClick={onClick}
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
    >
      {content}
    </button>
  );
}

type MobileSettingsEditorPanelProps = {
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  onClose: () => void;
};

export function MobileSettingsEditorPanel({
  children,
  className,
  closeLabel = '完成',
  onClose,
}: MobileSettingsEditorPanelProps) {
  return (
    <div
      className={cn(
        'mobile-settings-panel space-y-3 border-t border-black/[0.05] bg-gradient-to-b from-stone-50/80 via-white/88 to-white/96 px-3.5 py-3.5',
        className,
      )}
    >
      {children}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          className="h-9 rounded-xl border border-black/[0.05] bg-white/85 px-4 shadow-[0_4px_14px_rgba(15,23,42,0.06)] hover:bg-white"
          onClick={onClose}
        >
          {closeLabel}
        </Button>
      </div>
    </div>
  );
}
