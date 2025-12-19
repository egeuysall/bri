'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

export const PostFinder: React.FC = () => {
  const [post, setPost] = useState<string>('');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (post.trim()) {
      router.push(`/${post.trim()}`);
    }
  };

  return (
    <section className="gap-lg flex w-full flex-col items-center md:w-3/4">
      <form onSubmit={handleSubmit} className="gap-2xs flex w-full flex-col">
        <Label htmlFor="post-id">Post ID</Label>
        <Input
          id="post-id"
          ref={inputRef}
          value={post}
          onChange={e => setPost(e.target.value)}
          placeholder="e.g. abc123"
          className="w-full"
        />
        <Button type="submit" className="mt-sm w-full">
          Find Post
        </Button>
      </form>
    </section>
  );
};
