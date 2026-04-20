import { MarkdownAsync } from 'react-markdown';
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

export async function MarkdownContent({ postId, content }: MarkdownContentProps) {
  return (
    <MarkdownAsync
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children }) => <>{children}</>,
        code: ({ className, children, ...props }) => {
          const normalizedContent = String(children);
          const isBlock = className?.includes('language-') || normalizedContent.includes('\n');
          const isInline = !isBlock;

          if (isInline) {
            return <InlineCode {...props}>{children}</InlineCode>;
          }

          const language = className?.replace(/^language-/, '') || 'text';

          return <CodeBlock language={language}>{normalizedContent.replace(/\n$/, '')}</CodeBlock>;
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
