import { NextResponse } from 'next/server';
import { createPost } from '@/lib/posts';

type CreatePostPayload = {
  content?: unknown;
  slug?: unknown;
};

export async function POST(request: Request) {
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
    const result = await createPost({ content, slug });

    return NextResponse.json(
      { data: { slug: result.slug } },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create post';
    const status = message === 'Content cannot be empty' ? 400 : 500;

    return NextResponse.json(
      { error: status === 400 ? message : 'Failed to create post' },
      { status }
    );
  }
}
