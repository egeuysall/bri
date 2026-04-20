import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { MarkdownContent } from '@/components/markdown';
import { getNoteByUsernameAndSlug } from '@/lib/notes';

function stripLeadingHeading(content: string): string {
  const lines = content.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  if (!firstLine.startsWith('#')) {
    return content;
  }
  return lines.slice(1).join('\n').trimStart();
}

function formatDate(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const { getToken } = await auth();
  const token = (await getToken({ template: 'convex' })) ?? (await getToken()) ?? null;

  const note = await getNoteByUsernameAndSlug({
    username,
    slug,
    apiKey: token,
  });

  if (!note) {
    notFound();
  }

  const contentWithoutHeading = stripLeadingHeading(note.content);

  return (
    <section className="animate-enter mt-0!" style={{ '--delay': '40ms' } as CSSProperties}>
      <article className="prose prose-neutral prose-invert max-w-none prose-p:text-neutral-300 prose-headings:text-neutral-100 prose-h1:text-[1rem]! prose-h1:leading-6! prose-h1:font-semibold! prose-h2:text-[0.95rem]! prose-h2:leading-6! prose-h2:font-medium! prose-h3:text-[0.88rem]! prose-h3:leading-6! prose-h3:font-medium! prose-h4:text-[0.82rem]! prose-h4:leading-5! prose-h4:font-medium! prose-strong:text-neutral-100 prose-a:text-neutral-100 prose-a:decoration-neutral-700 prose-hr:border-neutral-900 prose-pre:border prose-pre:border-neutral-800">
        <header className="mb-6 border-b border-neutral-900 pb-5">
          <h1 className="!mt-0 !mb-0 text-base font-semibold text-neutral-100">{note.title}</h1>
          <p className="mt-2 text-xs text-neutral-400">
            @{note.username} &middot; {formatDate(note.createdAt)}
          </p>
        </header>

        <MarkdownContent postId={note.id} content={contentWithoutHeading} />
      </article>
    </section>
  );
}
