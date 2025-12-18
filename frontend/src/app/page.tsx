import React from 'react';
import { PostFinder } from '@/components/blocks/post-finder';
import { FileText, Link2, Zap } from 'lucide-react';

const Landing: React.FC = () => {
  return (
    <main className="flex md:items-center flex-col gap-md py-md">
      <section className="flex items-center flex-col gap-sm text-center">
        <div className="flex items-center justify-center gap-sm mb-sm">
          <FileText className="h-8 w-8 text-primary-600" />
          <h1 className="text-2xl font-bold">Bridge</h1>
        </div>
        <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-sm">
          Share Markdown instantly. No signup, no clutter—just clean, shareable links.
        </p>
      </section>
      
      <section className="flex flex-col gap-xs w-full md:items-center mb-md">
        <PostFinder />
      </section>

      <section className="flex justify-center gap-lg text-center">
        <div className="flex flex-col items-center gap-2xs">
          <Zap className="h-5 w-5 text-primary-600 mb-2xs" />
          <span className="text-sm font-medium">Instant</span>
        </div>
        <div className="flex flex-col items-center gap-2xs">
          <Link2 className="h-5 w-5 text-primary-600 mb-2xs" />
          <span className="text-sm font-medium">Shareable</span>
        </div>
      </section>
    </main>
  );
};

export default Landing;
