import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 border border-neutral-800 bg-transparent px-3 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition',
        'focus-visible:border-neutral-600',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Input };
