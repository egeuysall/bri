import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { revokeApiKey } from '@/lib/notes';
import { normalizeResourceId, rejectCrossOriginMutation } from '@/lib/request-security';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const blocked = rejectCrossOriginMutation(request);
  if (blocked) return blocked;

  const token = (await getToken({ template: 'convex' })) ?? (await getToken());
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id: rawId } = await params;
  const id = normalizeResourceId(rawId);
  if (!id) return NextResponse.json({ error: 'Invalid key id' }, { status: 400 });
  try {
    const data = await revokeApiKey({ token, keyId: id });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke api key';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
