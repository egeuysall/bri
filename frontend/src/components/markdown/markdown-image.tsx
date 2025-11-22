'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface MarkdownImageProps {
  src?: string;
  alt?: string;
  className?: string;
}

export function MarkdownImage({ src, alt = '', className }: MarkdownImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <span
        className={cn(
          'my-6 flex h-48 w-full items-center justify-center rounded-lg bg-neutral-200 dark:bg-neutral-800',
          className
        )}
      >
        <span className="text-neutral-500">Image unavailable</span>
      </span>
    );
  }

  const isDataUrl = src.startsWith('data:');

  return (
    <span className="my-6 block">
      <span className={cn('relative block overflow-hidden rounded-lg', className)}>
        <Image
          src={src}
          alt={alt}
          width={800}
          height={450}
          quality={75}
          loading="lazy"
          placeholder="empty"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 75vw, 50vw"
          className={cn(
            'h-80 w-full object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          onLoad={() => setIsLoading(false)}
          onError={() => setHasError(true)}
          unoptimized={isDataUrl}
        />
        {isLoading && (
          <span className="absolute inset-0 block animate-pulse bg-neutral-200 dark:bg-neutral-800" />
        )}
      </span>
    </span>
  );
}
