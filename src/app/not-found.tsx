import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <section className="pointer-events-none fixed inset-0 flex items-center justify-center">
      <div className="pointer-events-auto w-full max-w-lg px-6 py-8 text-center">
        <p className="text-4xl text-neutral-100">404</p>
        <p className="mt-4 text-sm text-neutral-400">This page does not exist.</p>
        <div className="mt-6 flex items-center justify-center">
          <Link
            href="/"
            className="text-sm text-neutral-200 underline-offset-4 hover:text-neutral-100 hover:underline"
          >
            Go home
          </Link>
        </div>
      </div>
    </section>
  );
}
