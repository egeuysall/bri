import { auth } from '@clerk/nextjs/server';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { NextResponse } from 'next/server';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { readBridgeApiKeyAuthFromRequest, rejectCookieBackedCrossOriginMutation, rejectCrossOriginMutation } from '@/lib/request-security';

async function credentials(request: Request) {
  const { userId, getToken } = await auth();
  const token = userId ? (await getToken({ template: 'convex' })) ?? (await getToken()) : null;
  const key = token ? null : await readBridgeApiKeyAuthFromRequest(request);
  return { token, key };
}

export async function GET(request: Request) {
  const { token, key } = await credentials(request);
  if (!token && !key) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const data = await fetchQuery(api.notes.listNoteFolders, { apiKey: key?.apiKey ?? null }, token ? { token } : {});
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load folders' }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const { token, key } = await credentials(request);
  if (!token && !key) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const blocked = token ? rejectCrossOriginMutation(request) : rejectCookieBackedCrossOriginMutation(request, key);
  if (blocked) return blocked;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  if (!['create', 'rename', 'delete', 'move'].includes(String(body.action))) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  try {
    const data = await fetchMutation(api.notes.changeNoteFolder, {
      apiKey: key?.apiKey ?? null,
      action: body.action as 'create' | 'rename' | 'delete' | 'move',
      folderId: typeof body.folderId === 'string' ? body.folderId as Id<'noteFolders'> : null,
      parentFolderId: typeof body.parentFolderId === 'string' ? body.parentFolderId as Id<'noteFolders'> : null,
      noteId: typeof body.noteId === 'string' ? body.noteId as Id<'notes'> : undefined,
      name: typeof body.name === 'string' ? body.name : undefined,
    }, token ? { token } : {});
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update folder' }, { status: 400 });
  }
}
