'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { normalizePathHandle, resolveUserHandleFromUser } from '@/lib/user-handle';

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const isAuthRoute = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
  const segments = pathname.split('/').filter(Boolean);
  const ownHandle = resolveUserHandleFromUser(user) ?? '';
  const shouldRedirectHomeToDashboard = isSignedIn && pathname === '/' && ownHandle.length > 0;
  const isOwnDashboardPath =
    isSignedIn &&
    segments.length === 1 &&
    ownHandle.length > 0 &&
    normalizePathHandle(segments[0] || '') === ownHandle;

  useEffect(() => {
    if (!shouldRedirectHomeToDashboard) return;
    router.replace(`/${ownHandle}`);
  }, [ownHandle, router, shouldRedirectHomeToDashboard]);

  if (shouldRedirectHomeToDashboard) {
    return <div className="min-h-screen bg-bg" />;
  }

  if (isAuthRoute || isOwnDashboardPath) {
    return <div className="min-h-screen bg-bg">{children}</div>;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-155 flex-col px-6 py-8 sm:px-8 sm:py-10">
      <header className="pb-8">
        <div className="flex items-end justify-between gap-6">
          <Link
            href="/"
            className="text-[15px] text-neutral-100 hover:text-neutral-300 focus-visible:text-neutral-300"
          >
            bri
          </Link>

          <div className="flex items-center">
            <SignInButton mode="redirect">
              <Button type="button" variant="ghost" className="h-8 text-xs">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <Button type="button" variant="ghost" className="h-8 border text-xs">
                Sign up
              </Button>
            </SignUpButton>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-8">{children}</main>

      <footer className="pt-8 text-xs text-neutral-400">
        <div className="flex items-center justify-between gap-4">
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
