'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Share2, Copy, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

const apiUrl = '/api/posts';

export default function CreateNewPost() {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [postId, setPostId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!markdownContent.trim()) {
      setError('Please enter some Markdown content');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(`${apiUrl}`, {
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
          // If we can't parse the error response, use the default message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Check if the response contains an error message
      if (data && data.error) {
        throw new Error(data.error);
      }

      // Handle both response formats: {slug: "slug"} or {data: {slug: "slug"}}
      let postId: string;
      if (data && data.data && data.data.slug) {
        // New format: {data: {slug: "slug"}}
        postId = data.data.slug;
      } else if (data && data.slug) {
        // Old format: {slug: "slug"}
        postId = data.slug;
      } else if (data && data.data && data.data.id) {
        // Legacy CLI format: {data: {id: "uuid"}}
        postId = data.data.id;
      } else if (data && data.id) {
        // Legacy direct format: {id: "uuid"}
        postId = data.id;
      } else {
        throw new Error('Invalid post ID received from server');
      }

      // Validate the post ID
      if (typeof postId !== 'string' || postId.trim() === '') {
        throw new Error('Invalid post ID received from server');
      }

      setPostId(postId);
      setSuccess(true);
    } catch (err) {
      console.error('Error creating post:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (postId) {
      const fullUrl = `${window.location.origin}/${postId}`;
      navigator.clipboard.writeText(fullUrl);
      setCopied(true);

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleViewPost = () => {
    if (postId) {
      router.push(`/${postId}`);
    }
  };

  return (
    <main className="gap-lg py-md flex flex-col items-center px-4">
      <div className="w-full">
        <Link className="mb-6 flex items-center text-sm" href="/">
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back to Home
        </Link>

        {!success ? (
          <main>
            <div className="gap-md mb-lg flex flex-col items-center text-center">
              <h3>Create New Post</h3>

              <p className="text-base text-neutral-600 dark:text-neutral-400">
                Paste your Markdown content below and get a shareable link instantly.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="gap-md flex flex-col">
              <div className="gap-2xs flex flex-col">
                <Label htmlFor="markdown-content">Markdown Content</Label>
                <Textarea
                  id="markdown-content"
                  value={markdownContent}
                  onChange={e => setMarkdownContent(e.target.value)}
                  placeholder="# Welcome to Bridge!"
                  className="max-h-125 min-h-75 font-mono"
                  required
                  autoFocus
                />
              </div>

              {error && <div className="text-center text-sm text-red-500">{error}</div>}

              <Button
                type="submit"
                disabled={isLoading || !markdownContent.trim()}
                className="gap-xs flex w-full items-center justify-center self-end"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Creating...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    Create Shareable Link
                  </>
                )}
              </Button>
            </form>
          </main>
        ) : (
          <div className="gap-lg flex flex-col items-center text-center">
            <div className="gap-sm flex flex-col items-center">
              <h4>Post Created Successfully!</h4>
              <p className="text-neutral-600 dark:text-neutral-400">
                Your Markdown content is now available at:
              </p>
            </div>

            <div className="gap-sm p-sm flex w-full items-center rounded-lg bg-neutral-200 dark:bg-neutral-700">
              <p className="flex-1 border-none bg-transparent text-sm">
                {window.location.origin}/{postId}
              </p>
              <Button
                type="button"
                onClick={handleCopyLink}
                className="px-sm py-xs"
                variant="ghost"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="gap-sm flex flex-col sm:flex-row">
              <Button onClick={handleViewPost} className="gap-xs flex items-center">
                <FileText className="h-4 w-4" />
                View Post
              </Button>
              <Button
                onClick={() => {
                  setMarkdownContent('');
                  setSuccess(false);
                  setPostId('');
                }}
                variant="outline"
                className="gap-xs flex items-center"
              >
                <FileText className="h-4 w-4" />
                Create Another
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
