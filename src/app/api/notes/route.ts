import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  createNoteWithApiKey,
  createNoteWithAuth,
  listMyNotes,
  type NoteVisibility,
} from '@/lib/notes';

function readApiKeyFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

function normalizeVisibility(value: unknown): NoteVisibility {
  return value === 'private' ? 'private' : 'public';
}

function normalizeExpiresInDays(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(30, value);
}

export async function GET(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const token = (await getToken({ template: 'convex' })) ?? (await getToken());
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = new URL(request.url);
  const state = url.searchParams.get('state') === 'deleted' ? 'deleted' : 'active';

  try {
    const notes = await listMyNotes({ state, token });
    return NextResponse.json({ data: notes });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: {
    content?: unknown;
    visibility?: unknown;
    expiresInDays?: unknown;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const content = typeof payload.content === 'string' ? payload.content : '';
  if (!content.trim()) {
    return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 });
  }

  const visibility = normalizeVisibility(payload.visibility);
  const expiresInDays = normalizeExpiresInDays(payload.expiresInDays);

  const { userId, getToken } = await auth();
  if (userId) {
    const token = (await getToken({ template: 'convex' })) ?? (await getToken());
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await currentUser();
    const username = (user?.username || '').trim().toLowerCase();
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    try {
      const result = await createNoteWithAuth({
        token,
        username,
        content,
        visibility,
        expiresInDays,
      });
      return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create note';
      const status =
        message === 'Not authenticated'
          ? 401
          : message === 'Username is required' || message === 'Content cannot be empty'
            ? 400
            : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  const apiKey = readApiKeyFromRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const result = await createNoteWithApiKey({
      apiKey,
      content,
      visibility,
      expiresInDays,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create note';
    const status =
      message === 'Invalid API key'
        ? 401
        : message === 'API key lacks write permission'
          ? 403
          : message === 'Content cannot be empty'
            ? 400
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
