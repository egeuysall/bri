import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  permanentlyDeleteNote,
  restoreNote,
  softDeleteNote,
  updateNote,
  type NoteVisibility,
} from '@/lib/notes';

function normalizeVisibility(value: unknown): NoteVisibility {
  return value === 'private' ? 'private' : 'public';
}

function normalizeExpiresInDays(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

async function requireConvexToken() {
  const { userId, getToken } = await auth();
  if (!userId) return null;
  const token = (await getToken({ template: 'convex' })) ?? (await getToken());
  return token ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await requireConvexToken();
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  let payload: {
    action?: unknown;
    content?: unknown;
    visibility?: unknown;
    expiresInDays?: unknown;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const action = typeof payload.action === 'string' ? payload.action : 'update';

  try {
    if (action === 'softDelete') {
      const data = await softDeleteNote({ token, noteId: id });
      return NextResponse.json({ data });
    }

    if (action === 'restore') {
      const data = await restoreNote({ token, noteId: id });
      return NextResponse.json({ data });
    }

    if (action === 'permanentDelete') {
      const data = await permanentlyDeleteNote({ token, noteId: id });
      return NextResponse.json({ data });
    }

    const content = typeof payload.content === 'string' ? payload.content : '';
    if (!content.trim()) {
      return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 });
    }

    const visibility = normalizeVisibility(payload.visibility);
    const expiresInDays = normalizeExpiresInDays(payload.expiresInDays);

    const data = await updateNote({
      token,
      noteId: id,
      content,
      visibility,
      expiresInDays,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update note';
    const status = message === 'Not authenticated' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
