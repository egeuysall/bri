'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { codeToHtml } from 'shiki';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ children, language = 'text', className }: CodeBlockProps) {
  const [html, setHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const handleCopyBlock = async (event: MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    const hasRangeSelection =
      selection &&
      selection.type === 'Range' &&
      selection.toString().trim().length > 0 &&
      ((selection.anchorNode && event.currentTarget.contains(selection.anchorNode)) ||
        (selection.focusNode && event.currentTarget.contains(selection.focusNode)));

    if (hasRangeSelection) {
      return;
    }

    try {
      await navigator.clipboard.writeText(children);
      toast.success('Copied to clipboard');
    } catch {
      // Ignore clipboard failures (e.g. blocked permissions).
    }
  };

  useEffect(() => {
    async function highlight() {
      try {
        const highlighted = await codeToHtml(children, {
          lang: language,
          theme: 'github-dark-default',
        });
        setHtml(highlighted);
      } catch {
        // Keep output escaped even in fallback path.
        const escaped = children.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        setHtml(`<pre><code>${escaped}</code></pre>`);
      } finally {
        setIsLoading(false);
      }
    }

    highlight();
  }, [children, language]);

  if (isLoading) {
    return (
      <div
        className={cn('code-block my-2 cursor-copy', className)}
        onClick={handleCopyBlock}
        title="Click to copy"
      >
        <pre className="overflow-x-auto border border-neutral-800 px-2.5 py-2 text-xs leading-5 text-neutral-200">
          <code>{children}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'code-block my-2 cursor-copy [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-neutral-800 [&_pre]:px-2.5 [&_pre]:py-2 [&_pre]:text-xs [&_pre]:leading-5',
        className
      )}
      onClick={handleCopyBlock}
      title="Click to copy"
      dangerouslySetInnerHTML={{ __html: html }}
    />
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
        'rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 font-mono text-[0.9em] font-normal text-neutral-200',
        className
      )}
    >
      {children}
    </code>
  );
}
