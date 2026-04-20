import Link from 'next/link';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-155 flex-col px-6 py-8 sm:px-8 sm:py-10">
      <header className="pb-8">
        <div className="flex items-end justify-between gap-6 pb-5">
          <Link
            href="/"
            className="text-[15px] text-neutral-100 hover:text-neutral-300 focus-visible:text-neutral-300"
          >
            bri
          </Link>
          <p className="text-xs text-neutral-400">Authentication</p>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center">{children}</main>

      <footer className="pt-8 text-xs text-neutral-400">
        <div className="flex items-center justify-between gap-4 pt-5">
          <a
            href="https://github.com/egeuysall/bri"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-400 hover:text-neutral-100 focus-visible:text-neutral-100"
          >
            GitHub
          </a>
          <p>&copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
