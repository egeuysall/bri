'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav className="flex items-center gap-4 text-xs text-neutral-400">
      <Link href="/" className="nav-link" aria-current={isNavActive(pathname, '/') ? 'page' : undefined}>
        Home
      </Link>
      <Link
        href="/new"
        className="nav-link"
        aria-current={isNavActive(pathname, '/new') ? 'page' : undefined}
      >
        Create
      </Link>
    </nav>
  );
}
