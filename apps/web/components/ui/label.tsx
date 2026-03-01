import * as React from 'react';

import { cn } from '../../lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium text-neutral-700 dark:text-neutral-300', className)} {...props} />
));
Label.displayName = 'Label';

export { Label };
