import { NextResponse } from 'next/server';
import { getNoteByUsernameAndSlug } from '@/lib/notes';
import { readBridgeApiKeyFromRequest } from '@/lib/request-security';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string; slug: string }> }
) {
  const { username, slug } = await params;
  const apiKey = readBridgeApiKeyFromRequest(request);

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
