import { NextResponse } from 'next/server';
import { getNoteByUsernameAndSlug } from '@/lib/notes';

function readApiKeyFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string; slug: string }> }
) {
  const { username, slug } = await params;
  const apiKey = readApiKeyFromRequest(request);

  try {
    const note = await getNoteByUsernameAndSlug({ username, slug, apiKey });
    if (!note) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        username: note.username,
        slug: note.slug,
        title: note.title,
        content: note.content,
        visibility: note.visibility,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
  }
}
