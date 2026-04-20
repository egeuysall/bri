import rehypePrettyCode from 'rehype-pretty-code';
import { MarkdownAsync } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import {
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
import { prettyCodeOptions } from './pretty-code';

interface MarkdownContentProps {
  postId: string;
  content: string;
}

export async function MarkdownContent({ postId, content }: MarkdownContentProps) {
  return (
    <MarkdownAsync
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypePrettyCode, prettyCodeOptions]]}
      components={{
        pre: ({ className, children, ...props }) => (
          <pre
            {...props}
            className={cn(
              'overflow-x-auto border border-neutral-800 px-2.5 py-2 text-xs leading-5',
              className
            )}
          >
            {children}
          </pre>
        ),
        code: ({ className, children, ...props }) => {
          const isInline = !className?.includes('language-');

          if (isInline) {
            return <InlineCode {...props}>{children}</InlineCode>;
          }

          return (
            <code className={className} {...props}>
              {children}
            </code>
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
        input: ({ type, checked, node }) => {
          if (type === 'checkbox') {
            const currentIndex = node?.position?.start?.offset ?? 0;
            return (
              <MarkdownCheckbox checked={checked} postId={postId} checkboxIndex={currentIndex} />
            );
          }
          return <input type={type} checked={checked} readOnly />;
        },
      }}
    >
      {content}
    </MarkdownAsync>
  );
}
