import { NextResponse } from 'next/server';
import { getNoteByUsernameAndSlug } from '@/lib/notes';
import { getMarkdownAlias } from '@/lib/post-slugs';

function readApiKeyFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

function getFilename(username: string, slug: string): string {
  const safe = `${username}-${getMarkdownAlias(slug)}`.replace(/[^a-zA-Z0-9._-]/g, '-');
  return safe;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string; slug: string }> }
) {
  const { username, slug } = await params;
  const apiKey = readApiKeyFromRequest(request);

  const note = await getNoteByUsernameAndSlug({
    username,
    slug,
    apiKey,
  });

  if (!note) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new Response(note.content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
      'Content-Disposition': `inline; filename="${getFilename(note.username, note.slug)}"`,
    },
  });
}
