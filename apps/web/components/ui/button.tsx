import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-2 dark:focus-visible:ring-[#FFD400]/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-neutral-900 text-white shadow-[0_4px_20px_rgba(0,0,0,0.16)] hover:bg-neutral-800 hover:shadow-[0_10px_24px_rgba(0,0,0,0.2)] dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200',
        primary:
          'bg-gradient-to-r from-amber-300 via-[#FFD400] to-yellow-400 text-neutral-900 shadow-[0_6px_20px_rgba(255,212,0,0.28)] hover:brightness-95 dark:from-amber-300 dark:via-[#FFD400] dark:to-yellow-400 dark:text-neutral-900',
        secondary:
          'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-800',
        ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
        outline:
          'bg-transparent text-neutral-700 border border-neutral-300 hover:bg-neutral-100 dark:text-neutral-300 dark:border-neutral-700 dark:hover:bg-neutral-800'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-lg px-6',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
