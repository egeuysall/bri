import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { syncMyUserProfile } from '@/lib/notes';
import { rejectCrossOriginMutation } from '@/lib/request-security';
import { resolveUserHandleFromUser } from '@/lib/user-handle';

async function requireToken() {
  const { userId, getToken } = await auth();
  if (!userId) return null;
  return (await getToken({ template: 'convex' })) ?? (await getToken()) ?? null;
}

export async function POST(request: Request) {
  const token = await requireToken();
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const blocked = rejectCrossOriginMutation(request);
  if (blocked) return blocked;

  const user = await currentUser();
  const username = resolveUserHandleFromUser(user);
  if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

  const displayName =
    typeof user?.fullName === 'string' && user.fullName.trim().length > 0
      ? user.fullName.trim()
      : null;
  const email =
    user?.primaryEmailAddress?.emailAddress && user.primaryEmailAddress.emailAddress.trim().length > 0
      ? user.primaryEmailAddress.emailAddress.trim().toLowerCase()
      : null;

  try {
    const data = await syncMyUserProfile({
      token,
      username,
      displayName,
      email,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync profile';
    const status =
      message === 'Not authenticated'
        ? 401
        : message === 'Username is required'
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
