import React from 'react';
import Link from 'next/link';
import { PostFinder } from '@/components/blocks/post-finder';
import { Iphone } from '@/components/ui/iphone';
import { Safari } from '@/components/ui/safari';
import { FileText, Share2, Bolt, Code2 } from 'lucide-react';

const Landing: React.FC = () => {
  return (
    <main className="gap-lg py-md flex flex-col items-center px-4">
      {/* Hero Section */}
      <section className="gap-md flex flex-col items-center text-center">
        <h3>Share Markdown Instantly</h3>

        <p className="mb-lg text-base text-neutral-600 md:text-lg dark:text-neutral-400">
          Paste Markdown, get a beautiful shareable link. No signup, no hassle.
        </p>

        {/* Main CTA */}
        <div className="flex w-full justify-center">
          <PostFinder />
        </div>

        {/* Quick Info */}
        <div className="gap-lg mt-xl flex flex-wrap justify-center text-center">
          <div className="gap-2xs px-xs flex flex-col items-center">
            <Bolt className="text-primary-600 h-6 w-6" />
            <span className="text-sm font-medium">Instant Sharing</span>
          </div>
          <div className="gap-2xs px-xs flex flex-col items-center">
            <Share2 className="text-primary-600 h-6 w-6" />
            <span className="text-sm font-medium">Clean Links</span>
          </div>
          <div className="gap-2xs px-xs flex flex-col items-center">
            <Code2 className="text-primary-600 h-6 w-6" />
            <span className="text-sm font-medium">Markdown Support</span>
          </div>
        </div>
      </section>

      {/* Device Mockups Section */}
      <section className="mt-lg w-full">
        <div className="flex justify-center">
          {/* Mobile iPhone Mockup - shown on small screens */}
          <div className="px-sm w-full md:hidden">
            <Iphone src="/user-mobile.png" className="mx-auto" />
          </div>

          {/* Desktop Safari Mockup - shown on medium+ screens */}
          <div className="px-sm hidden w-full md:block">
            <Safari imageSrc="/user-desktop.png" url="bridge.egeuysal.com" className="mx-auto" />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-lg w-full text-center">
        <h6 className="mb-sm">Share Markdown Now</h6>
        <p className="mb-lg text-base text-neutral-600 dark:text-neutral-400">
          Simple, fast Markdown sharing for everyone.
        </p>

        <div className="gap-sm flex flex-col items-center justify-center sm:flex-row">
          <Link href="/new" className="gap-xs px-md py-sm flex items-center">
            <FileText className="h-4 w-4" />
            Create Post
          </Link>
        </div>
      </section>
    </main>
  );
};

export default Landing;
