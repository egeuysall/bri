'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CodeBlock } from '@/components/markdown/code-block';
import { getMarkdownAlias } from '@/lib/post-slugs';

const apiUrl = '/api/posts';

export default function CreateNewPost() {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [postId, setPostId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!markdownContent.trim()) {
      setError('Please enter markdown content.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: markdownContent,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create post';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Keep default message when response body is invalid JSON.
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data && data.error) {
        throw new Error(data.error);
      }

      let slug: string;
      if (data && data.data && data.data.slug) {
        slug = data.data.slug;
      } else if (data && data.slug) {
        slug = data.slug;
      } else if (data && data.data && data.data.id) {
        slug = data.data.id;
      } else if (data && data.id) {
        slug = data.id;
      } else {
        throw new Error('Invalid post ID received from server');
      }

      if (typeof slug !== 'string' || slug.trim() === '') {
        throw new Error('Invalid post ID received from server');
      }

      setPostId(slug);
      setSuccess(true);
    } catch (err) {
      console.error('Error creating post:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPost = () => {
    if (!postId) return;
    router.push(`/${postId}`);
  };

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const postUrl = postId ? `${origin}/${postId}` : '';
  const markdownUrl = postId ? `${origin}/${getMarkdownAlias(postId)}` : '';

  return (
    <section className="animate-enter" style={{ '--delay': '40ms' } as CSSProperties}>
      {!success ? (
        <>
          <header className="mb-6 border-b border-neutral-900 pb-5">
            <h1 className="text-base font-semibold text-neutral-100">Create Post</h1>
            <p className="mt-2 text-xs text-neutral-400">Paste markdown and get slug link instantly.</p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              id="markdown-content"
              value={markdownContent}
              onChange={e => setMarkdownContent(e.target.value)}
              placeholder="# Context research\n\nWrite markdown..."
              className="min-h-[22rem] font-mono text-[13px]"
              required
              autoFocus
            />

            {error && <p className="text-xs text-red-400">{error}</p>}

            <Button
              type="submit"
              disabled={isLoading || !markdownContent.trim()}
              className="border-neutral-100 bg-neutral-100 text-neutral-950 hover:border-neutral-200 hover:bg-neutral-200"
            >
              {isLoading ? 'Creating...' : 'Create Link'}
            </Button>
          </form>
        </>
      ) : (
        <div className="space-y-4">
          <header className="mb-4 border-b border-neutral-900 pb-5">
            <h1 className="text-base font-semibold text-neutral-100">Post Ready</h1>
            <p className="mt-2 text-xs text-neutral-400">Click URL to copy:</p>
          </header>

          <CodeBlock language="text">{postUrl}</CodeBlock>
          <CodeBlock language="text">{markdownUrl}</CodeBlock>

          <div className="flex gap-2">
            <Button
              onClick={handleViewPost}
              className="border-neutral-100 bg-neutral-100 text-neutral-950 hover:border-neutral-200 hover:bg-neutral-200"
            >
              Open Post
            </Button>
            <Button
              onClick={() => {
                setMarkdownContent('');
                setSuccess(false);
                setPostId('');
              }}
              variant="outline"
            >
              Create Another
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
