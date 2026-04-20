'use client';

import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="flex min-h-[68vh] w-full items-center justify-center">
      <div className="w-full max-w-lg px-6 py-8 text-center">
        <p className="text-xs text-neutral-500">Error</p>
        <h1 className="mt-2 text-xl text-neutral-100">Something went wrong</h1>
        <p className="mt-2 text-sm text-neutral-400">{error.message || 'Unexpected application error.'}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="text-sm text-neutral-200 underline-offset-4 hover:text-neutral-100 hover:underline"
          >
            Try again
          </button>
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
