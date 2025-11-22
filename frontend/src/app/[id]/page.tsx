import { notFound } from 'next/navigation';
import type { Post } from '@/types/general';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CodeBlock,
  InlineCode,
  MarkdownImage,
  MarkdownTable,
  MarkdownTableHead,
  MarkdownTableBody,
  MarkdownTableRow,
  MarkdownTableHeaderCell,
  MarkdownTableDataCell,
  MarkdownCheckbox,
} from '@/components/markdown';

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
    <div className="flex w-full justify-center">
      <main className="flex w-full max-w-full flex-col md:max-w-3/4 lg:max-w-1/2">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Code blocks with syntax highlighting
              pre: ({ children }) => <>{children}</>,
              code: ({ className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match && !className;

                if (isInline) {
                  return <InlineCode {...props}>{children}</InlineCode>;
                }

                return (
                  <CodeBlock language={match?.[1] || 'text'}>
                    {String(children).replace(/\n$/, '')}
                  </CodeBlock>
                );
              },
              // Tables using shadcn components
              table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
              thead: ({ children }) => <MarkdownTableHead>{children}</MarkdownTableHead>,
              tbody: ({ children }) => <MarkdownTableBody>{children}</MarkdownTableBody>,
              tr: ({ children }) => <MarkdownTableRow>{children}</MarkdownTableRow>,
              th: ({ children }) => <MarkdownTableHeaderCell>{children}</MarkdownTableHeaderCell>,
              td: ({ children }) => <MarkdownTableDataCell>{children}</MarkdownTableDataCell>,
              // Images using Next.js Image component
              img: ({ src, alt }) => (
                <MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} />
              ),
              // Clickable checkboxes for task lists
              input: ({ type, checked }) => {
                if (type === 'checkbox') {
                  return <MarkdownCheckbox checked={checked} />;
                }
                return <input type={type} checked={checked} readOnly />;
              },
            }}
          >
            {data.content}
          </ReactMarkdown>
        </article>
      </main>
    </div>
  );
}
