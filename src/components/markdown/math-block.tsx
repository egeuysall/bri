import type { ReactNode } from 'react';
import katex from 'katex';
import { cn } from '@/lib/utils';

interface MathBlockProps {
  children?: ReactNode;
  latex?: string;
  className?: string;
}

function nodeToText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(nodeToText).join('');
  }

  return '';
}

export function MathBlock({ children, latex, className }: MathBlockProps) {
  const source = (latex ?? nodeToText(children)).trim();

  if (!source) {
    return null;
  }

  try {
    const html = katex.renderToString(source, {
      displayMode: true,
      throwOnError: false,
      strict: 'warn',
      trust: false,
    });

    return (
      <div
        className={cn('math-block', className)}
        data-latex={source}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <pre className={cn('math-block whitespace-pre-wrap', className)}>{source}</pre>;
  }
}
