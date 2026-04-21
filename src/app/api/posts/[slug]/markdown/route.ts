import { getMarkdownAlias } from '@/lib/post-slugs';
import { getPost } from '@/lib/posts';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function getFilename(slug: string): string {
  return getMarkdownAlias(slug).replace(/[^a-zA-Z0-9._-]/g, '-');
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex',
      },
    });
  }

  return new Response(post.content, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
      'Content-Disposition': `inline; filename="${getFilename(post.slug)}"`,
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
