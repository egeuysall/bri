'use client';

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { codeToHtml } from 'shiki';
import githubLight from 'shiki/themes/github-light.mjs';
import vesper from 'shiki/themes/vesper.mjs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ children, language = 'text', className }: CodeBlockProps) {
  const normalized = String(children);
  const [html, setHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLightMode, setIsLightMode] = useState<boolean>(false);

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
      await navigator.clipboard.writeText(normalized);
      toast.success('Copied to clipboard');
    } catch {
      // Ignore clipboard failures (e.g. blocked permissions).
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: light)');
    const update = () => setIsLightMode(media.matches);
    update();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    async function highlight() {
      setIsLoading(true);

      try {
        const highlighted = await codeToHtml(normalized, {
          lang: language,
          theme: isLightMode ? githubLight : vesper,
        });
        setHtml(highlighted);
      } catch {
        const escaped = normalized
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        setHtml(`<pre><code>${escaped}</code></pre>`);
      } finally {
        setIsLoading(false);
      }
    }

    highlight();
  }, [normalized, language, isLightMode]);

  if (isLoading) {
    return (
      <div
        className={cn('code-block my-2 cursor-copy', className)}
        onClick={handleCopyBlock}
        title="Click to copy"
      >
        <pre className="overflow-x-auto border border-neutral-800 px-2.5 py-2 text-xs leading-5 text-neutral-200">
          <code>{normalized}</code>
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
  children: ReactNode;
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
