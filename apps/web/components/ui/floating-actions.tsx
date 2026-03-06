import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';

export const floatingActionDockClass =
  'mobile-fab fixed right-6 z-50 flex flex-col-reverse gap-2 sm:right-6 lg:right-8';

export const floatingActionButtonClass = 'tenant-fab-button h-11 w-11';

export const modalCloseButtonClass =
  'inline-flex !h-10 !w-10 !min-h-10 !min-w-10 !shrink-0 !items-center !justify-center !rounded-full !border-0 !p-0 !leading-none bg-neutral-900 text-white shadow-[0_10px_24px_rgba(0,0,0,0.34)] ring-1 ring-black/20 transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200';

type FloatingActionDockProps = HTMLAttributes<HTMLDivElement>;

function FloatingActionDock({ className, ...props }: FloatingActionDockProps) {
  return <div className={cn(floatingActionDockClass, className)} {...props} />;
}

type FloatingActionButtonProps = Omit<ButtonProps, 'size'>;

function FloatingActionButton({
  className,
  type = 'button',
  ...props
}: FloatingActionButtonProps) {
  return (
    <Button
      type={type}
      size="icon"
      className={cn(floatingActionButtonClass, className)}
      {...props}
    />
  );
}

export { FloatingActionDock, FloatingActionButton };
