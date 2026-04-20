import type { ReactNode } from 'react';

interface MarkdownTableProps {
  children: ReactNode;
}

export function MarkdownTable({ children }: MarkdownTableProps) {
  return (
    <div className="my-4 w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function MarkdownTableHead({ children }: MarkdownTableProps) {
  return <thead className="border-b border-neutral-800">{children}</thead>;
}

export function MarkdownTableBody({ children }: MarkdownTableProps) {
  return <tbody>{children}</tbody>;
}

export function MarkdownTableRow({ children }: MarkdownTableProps) {
  return <tr className="border-b border-neutral-900">{children}</tr>;
}

export function MarkdownTableHeaderCell({ children }: MarkdownTableProps) {
  return <th className="px-2 py-2 text-left text-xs font-semibold text-neutral-300">{children}</th>;
}

export function MarkdownTableDataCell({ children }: MarkdownTableProps) {
  return <td className="px-2 py-2 text-xs text-neutral-300">{children}</td>;
}
