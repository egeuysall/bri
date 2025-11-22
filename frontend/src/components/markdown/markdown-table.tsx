import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

interface MarkdownTableProps {
  children: React.ReactNode;
}

export function MarkdownTable({ children }: MarkdownTableProps) {
  return <Table>{children}</Table>;
}

export function MarkdownTableHead({ children }: MarkdownTableProps) {
  return <TableHeader>{children}</TableHeader>;
}

export function MarkdownTableBody({ children }: MarkdownTableProps) {
  return <TableBody>{children}</TableBody>;
}

export function MarkdownTableRow({ children }: MarkdownTableProps) {
  return <TableRow>{children}</TableRow>;
}

export function MarkdownTableHeaderCell({ children }: MarkdownTableProps) {
  return <TableHead>{children}</TableHead>;
}

export function MarkdownTableDataCell({ children }: MarkdownTableProps) {
  return <TableCell>{children}</TableCell>;
}
