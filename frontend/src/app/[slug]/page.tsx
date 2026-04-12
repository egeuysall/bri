import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { MarkdownContent } from '@/components/markdown';
import { getPost } from '@/lib/posts';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getHeading(content: string): string {
  const line = content
    .split('\n')
    .find((item) => item.trim().startsWith('#'))
    ?.replace(/^#+\s*/, '')
    .trim();

  return line || 'Untitled';
}

function stripLeadingHeading(content: string): string {
  const lines = content.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  if (!firstLine.startsWith('#')) {
    return content;
  }
  return lines.slice(1).join('\n').trimStart();
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  const data = await getPost(slug);

  if (!data) {
    notFound();
  }

  const title = getHeading(data.content);
  const publishedAt = formatCreatedAt(data.createdAt);
  const contentWithoutLeadingHeading = stripLeadingHeading(data.content);

  return (
    <section className="animate-enter mt-0!" style={{ '--delay': '40ms' } as CSSProperties}>
      <article className="prose prose-neutral prose-invert max-w-none prose-p:text-neutral-300 prose-headings:text-neutral-100 prose-h1:text-[1rem]! prose-h1:leading-6! prose-h1:font-semibold! prose-h2:text-[0.95rem]! prose-h2:leading-6! prose-h2:font-medium! prose-h3:text-[0.88rem]! prose-h3:leading-6! prose-h3:font-medium! prose-h4:text-[0.82rem]! prose-h4:leading-5! prose-h4:font-medium! prose-strong:text-neutral-100 prose-a:text-neutral-100 prose-a:decoration-neutral-700 prose-hr:border-neutral-900 prose-pre:border prose-pre:border-neutral-800">
        <header className="mb-6 border-b border-neutral-900 pb-5">
          <h1 className="!mt-0 !mb-0 text-base font-semibold text-neutral-100">{title}</h1>
          <p className="mt-2 text-xs text-neutral-400">{publishedAt}</p>
        </header>

        <MarkdownContent postId={data.slug} content={contentWithoutLeadingHeading} />
      </article>
    </section>
  );
}
