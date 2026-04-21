import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { listPins, togglePinnedLink, togglePinnedNote } from '@/lib/notes';
import { normalizeResourceId, rejectCrossOriginMutation } from '@/lib/request-security';

function statusFromErrorMessage(message: string): number {
  if (
    message.includes('No auth provider found') ||
    message.includes('Invalid token') ||
    message.includes('Not authenticated')
  ) {
    return 401;
  }
  return 500;
}

async function requireToken() {
  const { userId, getToken } = await auth();
  if (!userId) return null;
  const token = await getToken({ template: 'convex' });
  return token ?? null;
}

export async function GET() {
  const token = await requireToken();
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const data = await listPins({ token });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch pins';
    return NextResponse.json({ error: message }, { status: statusFromErrorMessage(message) });
  }
}

export async function POST(request: Request) {
  const token = await requireToken();
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const blocked = rejectCrossOriginMutation(request);
  if (blocked) return blocked;

  let payload: { type?: unknown; id?: unknown };
  try {
    payload = (await request.json()) as { type?: unknown; id?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const type = payload.type;
  const id = typeof payload.id === 'string' ? normalizeResourceId(payload.id) : null;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    if (type === 'note') {
      const data = await togglePinnedNote({ token, noteId: id });
      return NextResponse.json({ data });
    }
    if (type === 'link') {
      const data = await togglePinnedLink({ token, linkId: id });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: 'Invalid pin type' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle pin';
    const status =
      message === 'Forbidden'
        ? 403
        : message === 'Note not found' || message === 'Quick link not found'
          ? 404
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
