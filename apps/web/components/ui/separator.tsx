import * as React from 'react';

import { cn } from '../../lib/utils';

export type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical';
};

export function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'shrink-0 bg-neutral-200 dark:bg-neutral-700',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className
      )}
      {...props}
    />
  );
}
