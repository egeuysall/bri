import type { CSSProperties } from 'react';
import { PostFinder } from '@/components/blocks/post-finder';
import { CliSection } from '@/components/blocks/cli-copy';

const Landing = () => {
  return (
    <>
      <section className="animate-enter" style={{ '--delay': '40ms' } as CSSProperties}>
        <p className="text-[13px] leading-relaxed text-neutral-200">Minimal markdown sharing. Paste once, ship link.</p>
        <p className="mt-2 text-xs text-neutral-400">No signup. Fast slug links. Clean rendering.</p>
      </section>

      <section className="mt-12 animate-enter" style={{ '--delay': '120ms' } as CSSProperties}>
        <h2 className="text-sm text-neutral-300">Find Existing Post</h2>
        <div className="mt-4">
          <PostFinder />
        </div>
      </section>

      <section className="mt-10 animate-enter" style={{ '--delay': '200ms' } as CSSProperties}>
        <h2 className="mb-4 text-sm text-neutral-300">CLI</h2>
        <CliSection />
      </section>
    </>
  );
};

export default Landing;
