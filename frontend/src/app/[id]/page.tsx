import { notFound } from 'next/navigation';
import type { Post } from '@/types/general';
import ReactMarkdown from 'react-markdown';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export const revalidate = 3600;
export const dynamic = 'force-static';

interface PageProps {
  params: { id: string };
}

async function getPost(id: string): Promise<Post | null> {
  try {
    const res = await fetch(`${apiUrl}/${encodeURIComponent(id)}`);

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return json.data as Post;
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
    return null;
  }

  const data = await getPost(id);

  if (!data) {
    notFound();
    return null;
  }

  return (
    <div className="w-full flex justify-center">
      <main className="w-full flex flex-col max-w-full md:max-w-3/4 lg:max-w-1/2">
        <section className="flex flex-col gap-md">
          <ReactMarkdown>{data.content}</ReactMarkdown>
        </section>
      </main>
    </div>
  );
}
