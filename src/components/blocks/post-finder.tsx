'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export const PostFinder: React.FC = () => {
  const [post, setPost] = useState<string>('');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = post.trim();
    if (slug) {
      router.push(`/${slug}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="py-4">
      <label htmlFor="post-id" className="mb-2 block text-sm text-neutral-400">
        Post Slug
      </label>
      <div className="flex items-center gap-2">
        <input
          id="post-id"
          ref={inputRef}
          value={post}
          onChange={e => setPost(e.target.value)}
          placeholder="e.g. agents--4nSt0w or context-research--2G8Y7A"
          autoComplete="off"
          className="h-9 w-full rounded-md border border-neutral-800 bg-transparent px-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
        />
        <Button
          type="submit"
          className="h-9 shrink-0 border-neutral-100 bg-neutral-100 text-neutral-950 hover:border-neutral-200 hover:bg-neutral-200"
        >
          Open
        </Button>
      </div>
    </form>
  );
};
