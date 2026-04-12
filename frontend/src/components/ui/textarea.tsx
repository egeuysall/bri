import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-16 w-full border border-neutral-800 bg-transparent px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition',
        'focus-visible:border-neutral-600',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
