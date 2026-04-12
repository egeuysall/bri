import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center border text-[11px] uppercase tracking-[0.16em] transition duration-150 disabled:cursor-not-allowed disabled:opacity-40',
  {
    variants: {
      variant: {
        default: 'border-neutral-700 text-neutral-200 hover:border-neutral-500 hover:text-neutral-100',
        destructive: 'border-red-700 text-red-300 hover:border-red-500',
        outline: 'border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-neutral-100',
        ghost: 'border-transparent text-neutral-300 hover:text-neutral-100',
      },
      size: {
        default: 'h-9 px-3',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
