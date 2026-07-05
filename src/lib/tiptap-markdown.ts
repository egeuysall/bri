import type { JSONContent } from '@tiptap/core';

type ListKind = 'bulletList' | 'orderedList' | 'taskList';

const EMPTY_DOC: JSONContent = { type: 'doc', content: [] };
const MARKDOWN_SEPARATOR_ROW = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/;

function textNode(text: string, marks?: JSONContent['marks']): JSONContent {
  return marks?.length ? { type: 'text', text, marks } : { type: 'text', text };
}

function paragraph(text: string): JSONContent {
  return text.trim()
    ? { type: 'paragraph', content: parseInlineMarkdown(text.trim()) }
    : { type: 'paragraph' };
}

function expandMarkdownTableLines(line: string) {
  const rowParts = line.split(/\|\s+\|/);
  if (rowParts.length >= 2) {
    return rowParts
      .map((part, index) => {
        const prefix = index === 0 ? '' : '|';
        const suffix = index === rowParts.length - 1 ? '' : '|';
        return `${prefix}${part}${suffix}`.trim();
      })
      .filter((row) => row.includes('|'));
  }

  return [line.trim()];
}

export function normalizeMarkdownTables(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .flatMap((line) => {
      if (!line.includes('|')) return [line];
      return expandMarkdownTableLines(line);
    })
    .join('\n');
}

function parseMarkdownTableLines(lines: string[]): JSONContent | null {
  const normalizedLines = lines
    .flatMap(expandMarkdownTableLines)
    .map((line) => line.trim())
    .filter(Boolean);
  const headerIndex = normalizedLines.findIndex(
    (line, index) =>
      index < normalizedLines.length - 1 &&
      line.includes('|') &&
      MARKDOWN_SEPARATOR_ROW.test(normalizedLines[index + 1] ?? '')
  );

  if (headerIndex < 0) return null;

  const tableLines = normalizedLines.slice(headerIndex).filter((line) => line.includes('|'));
  const rows = tableLines
    .filter((_, index) => index !== 1)
    .map((line) =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())
    );
  const columnCount = Math.max(...rows.map((row) => row.length));
  if (rows.length < 2 || columnCount < 2) return null;

  return {
    type: 'table',
    content: rows.map((row, rowIndex) => ({
      type: 'tableRow',
      content: Array.from({ length: columnCount }, (_, index) => ({
        type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
        content: [paragraph(row[index] ?? '')],
      })),
    })),
  };
}

function imageBlock(alt: string, src: string, title?: string): JSONContent {
  return {
    type: 'image',
    attrs: {
      src,
      alt: alt.trim() || 'image',
      title: title?.trim() || null,
    },
  };
}

function isSafeImageSrc(value: string): boolean {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:image/')
  );
}

function listItem(kind: ListKind, text: string, checked = false): JSONContent {
  const item: JSONContent = {
    type: kind === 'taskList' ? 'taskItem' : 'listItem',
    content: [paragraph(text)],
  };
  if (kind === 'taskList') {
    item.attrs = { checked };
  }
  return item;
}

function listBlock(kind: ListKind, items: JSONContent[]): JSONContent {
  return { type: kind, content: items };
}

function parseInlineMarkdown(input: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  const pattern = /(\$([^$\n]+)\$|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(textNode(input.slice(lastIndex, match.index)));
    }

    if (match[2]) {
      nodes.push({ type: 'inlineMath', attrs: { latex: match[2] } });
    } else if (match[3] && match[4]) {
      nodes.push(
        textNode(match[3], [{ type: 'link', attrs: { href: match[4], target: '_blank' } }]),
      );
    } else if (match[5]) {
      nodes.push(textNode(match[5], [{ type: 'bold' }]));
    } else if (match[6]) {
      nodes.push(textNode(match[6], [{ type: 'italic' }]));
    } else if (match[7]) {
      nodes.push(textNode(match[7], [{ type: 'code' }]));
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < input.length) {
    nodes.push(textNode(input.slice(lastIndex)));
  }

  return nodes.length ? nodes : [textNode(input)];
}

function flushParagraph(buffer: string[], blocks: JSONContent[]) {
  if (buffer.length === 0) return;
  blocks.push(paragraph(buffer.join(' ')));
  buffer.length = 0;
}

function flushList(kind: ListKind | null, items: JSONContent[], blocks: JSONContent[]) {
  if (!kind || items.length === 0) return;
  blocks.push(listBlock(kind, [...items]));
  items.length = 0;
}

export function markdownToTiptapDocument(markdown: string): JSONContent {
  const lines = normalizeMarkdownTables(markdown).split('\n');
  const blocks: JSONContent[] = [];
  const paragraphBuffer: string[] = [];
  const listItems: JSONContent[] = [];
  let listKind: ListKind | null = null;
  let codeFence: { language: string | null; lines: string[] } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fenceMatch = line.match(/^```([a-zA-Z0-9_-]+)?\s*$/);
    if (fenceMatch) {
      if (codeFence) {
        blocks.push({
          type: 'codeBlock',
          attrs: { language: codeFence.language },
          content: codeFence.lines.length ? [textNode(codeFence.lines.join('\n'))] : undefined,
        });
        codeFence = null;
      } else {
        flushParagraph(paragraphBuffer, blocks);
        flushList(listKind, listItems, blocks);
        listKind = null;
        codeFence = { language: fenceMatch[1] ?? null, lines: [] };
      }
      continue;
    }

    if (codeFence) {
      codeFence.lines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listKind, listItems, blocks);
      listKind = null;
      continue;
    }

    if (line.trim().startsWith('$$')) {
      const mathLines = [line.trim().slice(2)];
      let nextIndex = index;
      while (!mathLines.at(-1)?.endsWith('$$') && nextIndex + 1 < lines.length) {
        nextIndex += 1;
        mathLines.push(lines[nextIndex] ?? '');
      }
      if (mathLines.at(-1)?.endsWith('$$')) {
        flushParagraph(paragraphBuffer, blocks);
        flushList(listKind, listItems, blocks);
        listKind = null;
        mathLines[mathLines.length - 1] = mathLines.at(-1)?.slice(0, -2) ?? '';
        blocks.push({
          type: 'blockMath',
          attrs: { latex: mathLines.join('\n').trim() },
        });
        index = nextIndex;
        continue;
      }
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch?.[1] && headingMatch[2]) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listKind, listItems, blocks);
      listKind = null;
      blocks.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: parseInlineMarkdown(headingMatch[2]),
      });
      continue;
    }

    if (line.includes('|')) {
      const tableCandidate = [line];
      let nextIndex = index + 1;
      while (nextIndex < lines.length && lines[nextIndex]?.includes('|')) {
        tableCandidate.push(lines[nextIndex] ?? '');
        nextIndex += 1;
      }
      const table = parseMarkdownTableLines(tableCandidate);
      if (table) {
        flushParagraph(paragraphBuffer, blocks);
        flushList(listKind, listItems, blocks);
        listKind = null;
        blocks.push(table);
        index = nextIndex - 1;
        continue;
      }
    }

    const imageMatch = line.match(/^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]+)")?\)$/);
    if (imageMatch?.[2] && isSafeImageSrc(imageMatch[2])) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listKind, listItems, blocks);
      listKind = null;
      blocks.push(imageBlock(imageMatch[1] ?? 'image', imageMatch[2], imageMatch[3]));
      continue;
    }

    const taskMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (taskMatch?.[2]) {
      flushParagraph(paragraphBuffer, blocks);
      if (listKind && listKind !== 'taskList') {
        flushList(listKind, listItems, blocks);
      }
      listKind = 'taskList';
      listItems.push(listItem('taskList', taskMatch[2], taskMatch[1]?.toLowerCase() === 'x'));
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (bulletMatch?.[1]) {
      flushParagraph(paragraphBuffer, blocks);
      if (listKind && listKind !== 'bulletList') {
        flushList(listKind, listItems, blocks);
      }
      listKind = 'bulletList';
      listItems.push(listItem('bulletList', bulletMatch[1]));
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedMatch?.[1]) {
      flushParagraph(paragraphBuffer, blocks);
      if (listKind && listKind !== 'orderedList') {
        flushList(listKind, listItems, blocks);
      }
      listKind = 'orderedList';
      listItems.push(listItem('orderedList', orderedMatch[1]));
      continue;
    }

    flushList(listKind, listItems, blocks);
    listKind = null;
    paragraphBuffer.push(line.trim());
  }

  if (codeFence) {
    blocks.push({
      type: 'codeBlock',
      attrs: { language: codeFence.language },
      content: codeFence.lines.length ? [textNode(codeFence.lines.join('\n'))] : undefined,
    });
  }
  flushParagraph(paragraphBuffer, blocks);
  flushList(listKind, listItems, blocks);

  return blocks.length ? { type: 'doc', content: blocks } : EMPTY_DOC;
}

function markText(text: string, marks: JSONContent['marks']) {
  if (!marks?.length) return text;
  return marks.reduce((value, mark) => {
    if (mark.type === 'bold') return `**${value}**`;
    if (mark.type === 'italic') return `*${value}*`;
    if (mark.type === 'code') return `\`${value}\``;
    if (mark.type === 'link') {
      const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';
      return href.startsWith('http://') || href.startsWith('https://') ? `[${value}](${href})` : value;
    }
    return value;
  }, text);
}

function inlineMarkdown(node: JSONContent): string {
  if (node.type === 'text') return markText(node.text ?? '', node.marks);
  if (node.type === 'inlineMath') return `$${String(node.attrs?.latex ?? '')}$`;
  return (node.content ?? []).map(inlineMarkdown).join('');
}

function nodeToMarkdown(node: JSONContent, index = 0): string {
  const text = inlineMarkdown(node);
  if (node.type === 'heading') {
    const level = typeof node.attrs?.level === 'number' ? Math.min(3, Math.max(1, node.attrs.level)) : 1;
    return `${'#'.repeat(level)} ${text}`;
  }
  if (node.type === 'paragraph') return text;
  if (node.type === 'blockMath') return `$$${String(node.attrs?.latex ?? '')}$$`;
  if (node.type === 'codeBlock') return `\`\`\`${node.attrs?.language ?? ''}\n${text}\n\`\`\``;
  if (node.type === 'bulletList') {
    return (node.content ?? []).map((item) => `- ${inlineMarkdown(item)}`).join('\n');
  }
  if (node.type === 'orderedList') {
    return (node.content ?? []).map((item, itemIndex) => `${itemIndex + 1}. ${inlineMarkdown(item)}`).join('\n');
  }
  if (node.type === 'taskList') {
    return (node.content ?? [])
      .map((item) => `- [${item.attrs?.checked ? 'x' : ' '}] ${inlineMarkdown(item)}`)
      .join('\n');
  }
  if (node.type === 'table') {
    const rows = (node.content ?? []).filter((row) => row.type === 'tableRow');
    const tableRows = rows.map((row) => row.content ?? []);
    const columnCount = Math.max(0, ...tableRows.map((row) => row.length));
    if (rows.length === 0 || columnCount === 0) return '';
    const cells = tableRows.map((row) =>
      Array.from({ length: columnCount }, (_, cellIndex) =>
        inlineMarkdown(row[cellIndex] ?? {}).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
      )
    );
    const header = cells[0] ?? [];
    const separator = Array.from({ length: columnCount }, () => '---');
    const toLine = (lineCells: string[]) => `| ${lineCells.join(' | ')} |`;
    return [toLine(header), toLine(separator), ...cells.slice(1).map(toLine)].join('\n');
  }
  if (node.type === 'image') {
    const src = typeof node.attrs?.src === 'string' ? node.attrs.src.trim() : '';
    if (!src) return '';
    const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt.replace(/[\[\]\n]/g, ' ') : 'image';
    const title =
      typeof node.attrs?.title === 'string' && node.attrs.title.trim()
        ? ` "${node.attrs.title.trim().replace(/"/g, '\\"')}"`
        : '';
    return `![${alt}](${src}${title})`;
  }
  if (node.type === 'listItem' || node.type === 'taskItem') return text;
  return index >= 0 ? text : '';
}

export function tiptapDocumentToMarkdown(document: JSONContent): string {
  return (document.content ?? [])
    .map((node, index) => nodeToMarkdown(node, index))
    .filter((block) => block.trim().length > 0)
    .join('\n\n')
    .trim();
}
