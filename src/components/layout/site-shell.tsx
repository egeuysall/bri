'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { resolveUserHandleFromUser } from '@/lib/user-handle';

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const isLandingRoute = pathname === '/';
  const ownHandle = resolveUserHandleFromUser(user) ?? '';
  const shouldRedirectHomeToDashboard = isSignedIn && isLandingRoute && ownHandle.length > 0;

  useEffect(() => {
    if (!isLoaded || !shouldRedirectHomeToDashboard) return;
    router.replace(`/${ownHandle}`);
  }, [isLoaded, ownHandle, router, shouldRedirectHomeToDashboard]);

  if (!isLandingRoute) {
    return <div className="min-h-screen bg-bg">{children}</div>;
  }

  if (shouldRedirectHomeToDashboard) {
    return <div className="min-h-screen bg-bg" />;
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

          {isLoaded && !isSignedIn ? (
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
          ) : (
            <div className="h-8 w-[132px]" aria-hidden />
          )}
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
