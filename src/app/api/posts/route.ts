import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createPost } from '@/lib/posts';
import { rejectCrossOriginMutation } from '@/lib/request-security';

type CreatePostPayload = {
  content?: unknown;
  slug?: unknown;
};

export async function POST(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const blocked = rejectCrossOriginMutation(request);
  if (blocked) return blocked;

  const token = (await getToken({ template: 'convex' })) ?? (await getToken());
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let payload: CreatePostPayload;

  try {
    payload = (await request.json()) as CreatePostPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const content = typeof payload.content === 'string' ? payload.content : '';
  const slug = typeof payload.slug === 'string' ? payload.slug : undefined;

  if (!content.trim()) {
    return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 });
  }

  try {
    const result = await createPost({ content, slug, token });

    return NextResponse.json(
      { data: { slug: result.slug } },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create post';
    const status =
      message === 'Content cannot be empty' || message === 'Slug cannot end with .md'
        ? 400
        : message === 'Not authenticated'
          ? 401
          : 500;

    return NextResponse.json(
      { error: status === 400 ? message : 'Failed to create post' },
      { status }
    );
  }
}
