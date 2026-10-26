import { NextResponse } from 'next/server';
import { listPublicNotesByUsername } from '@/lib/notes';
import { isPublicUsernamePath, normalizePathHandle } from '@/lib/user-handle';

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (username.length > 64 || !isPublicUsernamePath(username)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const handle = normalizePathHandle(username);
    const notes = await listPublicNotesByUsername({ username: handle });
    return NextResponse.json({ data: notes.map(({ username: noteUsername, slug, title, createdAt }) => ({ username: noteUsername, slug, title, createdAt })) }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Could not load public notes.' }, { status: 503 });
  }
}
