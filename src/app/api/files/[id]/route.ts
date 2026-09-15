import { fetchQuery } from 'convex/nextjs';
import { NextResponse } from 'next/server';
import { api } from '../../../../../convex/_generated/api';
import { normalizeResourceId } from '@/lib/request-security';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = normalizeResourceId(rawId);
  if (!id) return NextResponse.json({ error: 'Invalid file id' }, { status: 400 });

  try {
    const url = await fetchQuery(api.files.getUrl, { fileId: id as never });
    if (!url) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    return NextResponse.redirect(url, {
      status: 302,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File unavailable' }, { status: 404 });
  }
}
