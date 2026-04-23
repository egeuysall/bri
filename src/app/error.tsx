'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="pointer-events-none fixed inset-0 flex items-center justify-center">
      <div className="pointer-events-auto w-full max-w-lg px-6 py-8 text-center">
        <p className="text-xs text-neutral-500">Error</p>
        <h1 className="mt-2 text-xl text-neutral-100">Something went wrong</h1>
        <p className="mt-2 text-sm text-neutral-400">{error.message || 'Unexpected application error.'}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            type="button"
            onClick={reset}
            variant="ghost"
            className="h-8 px-2 text-sm text-neutral-200 hover:underline"
          >
            Try again
          </Button>
          <Link
            href="/"
            className="text-sm text-neutral-400 underline-offset-4 hover:text-neutral-200 hover:underline"
          >
            Go home
          </Link>
        </div>
      </div>
    </section>
  );
}
