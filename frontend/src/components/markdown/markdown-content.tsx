'use client';

import { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CodeBlock,
  InlineCode,
  MarkdownImage,
  MarkdownTable,
  MarkdownTableHead,
  MarkdownTableBody,
  MarkdownTableRow,
  MarkdownTableHeaderCell,
  MarkdownTableDataCell,
  MarkdownCheckbox,
} from './index';

interface MarkdownContentProps {
  postId: string;
  content: string;
}

export function MarkdownContent({ postId, content }: MarkdownContentProps) {
  const checkboxCounter = useRef(0);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code blocks with syntax highlighting
        pre: ({ children }) => <>{children}</>,
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !className;

          if (isInline) {
            // Remove backticks from inline code content
            const content = String(children).replace(/^`|`$/g, '');
            return <InlineCode {...props}>{content}</InlineCode>;
          }

          return (
            <CodeBlock language={match?.[1] || 'text'}>
              {String(children).replace(/\n$/, '')}
            </CodeBlock>
          );
        },
        // Tables using shadcn components
        table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
        thead: ({ children }) => <MarkdownTableHead>{children}</MarkdownTableHead>,
        tbody: ({ children }) => <MarkdownTableBody>{children}</MarkdownTableBody>,
        tr: ({ children }) => <MarkdownTableRow>{children}</MarkdownTableRow>,
        th: ({ children }) => <MarkdownTableHeaderCell>{children}</MarkdownTableHeaderCell>,
        td: ({ children }) => <MarkdownTableDataCell>{children}</MarkdownTableDataCell>,
        // Images using Next.js Image component
        img: ({ src, alt }) => (
          <MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} />
        ),
        // Clickable checkboxes for task lists
        input: ({ type, checked }) => {
          if (type === 'checkbox') {
            const currentIndex = checkboxCounter.current;
            checkboxCounter.current += 1;
            return (
              <MarkdownCheckbox checked={checked} postId={postId} checkboxIndex={currentIndex} />
            );
          }
          return <input type={type} checked={checked} readOnly />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
