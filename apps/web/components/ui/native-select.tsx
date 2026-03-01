import * as React from 'react';

import { cn } from '../../lib/utils';

export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
NativeSelect.displayName = 'NativeSelect';

export { NativeSelect };
