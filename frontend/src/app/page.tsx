import React from 'react';
import { PostFinder } from '@/components/blocks/post-finder';

const Landing: React.FC = () => {
  return (
    <main className="flex md:items-center flex-col gap-lg">
      <section className="flex items-center flex-col gap-2xs">
        <h1 className="md:text-center">Welcome to Bridge!</h1>
        <p className="md:w-3/4 lg:w-1/2 text-neutral-700 dark:text-neutral-300 md:text-center">
          Share your Markdown files quickly and easily. Upload a file or paste your Markdown and get
          a clean, shareable link instantly. No accounts needed, no clutter, just simple Markdown
          sharing.
        </p>
      </section>
      <section className="flex flex-col gap-2xs w-full md:items-center">
        <PostFinder />
      </section>
    </main>
  );
};

export default Landing;
