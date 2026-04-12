'use client';

import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface MarkdownImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  className?: string;
}

function sanitizeImageSrc(src?: string): string {
  if (!src) return '';
  const value = src.trim();
  if (!value) return '';
  if (/^javascript:/i.test(value)) return '';
  return value;
}

export function MarkdownImage({ src, alt = '', className, ...props }: MarkdownImageProps) {
  const safeSrc = sanitizeImageSrc(src);
  const normalizedAlt = alt.trim() || 'Image';

  if (!safeSrc) return null;
  return (
    <figure
      className={cn(
        'not-prose my-6 aspect-video overflow-hidden rounded-sm border border-neutral-800 p-6 md:p-8 bg-neutral-900',
        className
      )}
    >
      <img
        src={safeSrc}
        alt={normalizedAlt}
        loading="lazy"
        decoding="async"
        className="block h-full w-full max-w-none origin-top-left scale-150 rounded-sm object-cover object-top-left grayscale md:rounded-md shadow-[0_8px_16px_-12px_rgba(0,0,0,0.3)]"
        {...props}
      />
    </figure>
  );
}
