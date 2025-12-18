'use client';

import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ children, language = 'text', className }: CodeBlockProps) {
  const [lightHtml, setLightHtml] = useState<string>('');
  const [darkHtml, setDarkHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function highlight() {
      try {
        const [light, dark] = await Promise.all([
          codeToHtml(children, {
            lang: language,
            theme: 'github-light',
          }),
          codeToHtml(children, {
            lang: language,
            theme: 'github-dark',
          }),
        ]);
        setLightHtml(light);
        setDarkHtml(dark);
      } catch {
        // Fallback for unsupported languages
        const escaped = children.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const lightFallback = `<pre style="background-color: rgb(214, 214, 214);"><code>${escaped}</code></pre>`;
        const darkFallback = `<pre style="background-color: rgb(41, 41, 41);"><code>${escaped}</code></pre>`;
        setLightHtml(lightFallback);
        setDarkHtml(darkFallback);
      } finally {
        setIsLoading(false);
      }
    }

    highlight();
  }, [children, language]);

  if (isLoading) {
    return (
      <div className={cn('code-block my-4', className)}>
        <pre className="overflow-x-auto rounded-lg bg-neutral-200 p-4 font-mono text-sm dark:bg-neutral-700">
          <code>{children}</code>
        </pre>
      </div>
    );
  }

  return (
    <>
      {/* Light mode */}
      <div
        className={cn(
          'code-block my-4 block dark:hidden',
          '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-200 [&_pre]:p-4 [&_pre]:text-sm',
          className
        )}
        dangerouslySetInnerHTML={{ __html: lightHtml }}
      />
      {/* Dark mode */}
      <div
        className={cn(
          'code-block my-4 hidden dark:block',
          '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:!bg-neutral-700 [&_pre]:p-4 [&_pre]:text-sm',
          className
        )}
        dangerouslySetInnerHTML={{ __html: darkHtml }}
      />
    </>
  );
}

interface InlineCodeProps {
  children: React.ReactNode;
  className?: string;
}

export function InlineCode({ children, className }: InlineCodeProps) {
  return (
    <code
      className={cn(
        'rounded-md bg-neutral-200 px-1.5 py-0.5 font-mono text-[0.9em] font-normal text-red-600 dark:bg-neutral-700 dark:text-red-400',
        className
      )}
    >
      {children}
    </code>
  );
}
