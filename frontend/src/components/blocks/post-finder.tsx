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
    <section className="flex items-center flex-col gap-lg w-full md:w-3/4 lg:w-1/2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2xs w-full">
        <Label htmlFor="post-id">Post ID</Label>
        <Input
          id="post-id"
          ref={inputRef}
          value={post}
          onChange={(e) => setPost(e.target.value)}
          placeholder="e.g. abc123"
          className="w-full"
        />
        <Button type="submit" className="w-full mt-sm">
          Find Post
        </Button>
      </form>
    </section>
  );
};
