import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { MarkdownContent } from '@/components/markdown';
import { getPost } from '@/lib/posts';

export const revalidate = 60; // 1 minute for new posts detection

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
    return null;
  }

  const data = await getPost(slug);

  if (!data) {
    notFound();
    return null;
  }

  return (
    <div className="flex w-full justify-center">
      <main className="flex w-full max-w-full flex-col md:max-w-3/4 lg:max-w-1/2">
        <Link className="mb-6 flex items-center text-sm" href="/">
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back to Home
        </Link>
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <MarkdownContent postId={data.slug} content={data.content} />
        </article>
      </main>
    </div>
  );
}
