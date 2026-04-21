import { createHash, randomBytes } from 'node:crypto';
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createApiKeyHashed, listMyApiKeys } from '@/lib/notes';
import { rejectCrossOriginMutation } from '@/lib/request-security';
import { resolveUserHandleFromUser } from '@/lib/user-handle';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const token = (await getToken({ template: 'convex' })) ?? (await getToken());
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const data = await listMyApiKeys({ token });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch api keys' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const blocked = rejectCrossOriginMutation(request);
  if (blocked) return blocked;

  const token = (await getToken({ template: 'convex' })) ?? (await getToken());
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const user = await currentUser();
  const username = resolveUserHandleFromUser(user);
  if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

  let payload: {
    permissions?: unknown;
    label?: unknown;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    payload = {};
  }

  const permissions =
    payload.permissions === 'read' || payload.permissions === 'write' || payload.permissions === 'read_write'
      ? payload.permissions
      : 'read';
  const label =
    typeof payload.label === 'string' ? payload.label.trim().slice(0, 64) || null : null;

  const prefix = `bri_${randomBytes(6).toString('base64url')}`;
  const secret = randomBytes(24).toString('base64url');
  const rawKey = `${prefix}.${secret}`;
  const keyHash = sha256Hex(rawKey);

  try {
    await createApiKeyHashed({
      token,
      username,
      prefix,
      keyHash,
      permissions,
      label,
    });
    return NextResponse.json({
      data: {
        key: rawKey,
        prefix,
        permissions,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create api key';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
