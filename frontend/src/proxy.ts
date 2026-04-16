import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isMarkdownAlias, stripMarkdownAlias } from '@/lib/post-slugs';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length !== 1) {
    return NextResponse.next();
  }

  const [slug] = segments;
  if (!slug || !isMarkdownAlias(slug)) {
    return NextResponse.next();
  }

  const normalizedSlug = stripMarkdownAlias(slug).trim();
  if (!normalizedSlug) {
    return NextResponse.next();
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/api/posts/${encodeURIComponent(normalizedSlug)}/markdown`;

  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: '/:path*',
};
