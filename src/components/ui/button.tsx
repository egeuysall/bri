import * as React from 'react';
import { cn } from '@/lib/utils';

const baseClass =
  'inline-flex items-center justify-center rounded-md border text-sm transition duration-150 disabled:cursor-not-allowed disabled:opacity-40';

const variantClassMap = {
  default: 'border-neutral-700 text-neutral-200 hover:border-neutral-500 hover:text-neutral-100',
  destructive: 'border-red-700 text-red-300 hover:border-red-500',
  outline: 'border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-neutral-100',
  ghost: 'border-transparent text-neutral-300 hover:text-neutral-100',
} as const;

const sizeClassMap = {
  default: 'h-9 px-3',
  icon: 'h-8 w-8',
} as const;

type ButtonVariant = keyof typeof variantClassMap;
type ButtonSize = keyof typeof sizeClassMap;

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: React.ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const variantClass = variantClassMap[variant];
  const sizeClass = sizeClassMap[size];

  return (
    <button
      data-slot="button"
      className={cn(baseClass, variantClass, sizeClass, className)}
      {...props}
    />
  );
}

export { Button };
