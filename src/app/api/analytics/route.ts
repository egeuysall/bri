import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getMyAnalytics } from '@/lib/notes';
import { clampAnalyticsDays } from '@/lib/request-security';

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
  const token = (await getToken({ template: 'convex' })) ?? (await getToken());
  return token ?? null;
}

export async function GET(request: Request) {
  const token = await requireToken();
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(request.url);
  const days = clampAnalyticsDays(url.searchParams.get('days'));

  try {
    const data = await getMyAnalytics({ token, days });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch analytics';
    return NextResponse.json({ error: message }, { status: statusFromErrorMessage(message) });
  }
}
