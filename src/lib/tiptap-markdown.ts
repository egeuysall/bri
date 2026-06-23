import type { JSONContent } from '@tiptap/core';

type ListKind = 'bulletList' | 'orderedList' | 'taskList';

const EMPTY_DOC: JSONContent = { type: 'doc', content: [] };

function textNode(text: string, marks?: JSONContent['marks']): JSONContent {
  return marks?.length ? { type: 'text', text, marks } : { type: 'text', text };
}

function paragraph(text: string): JSONContent {
  return text.trim()
    ? { type: 'paragraph', content: parseInlineMarkdown(text.trim()) }
    : { type: 'paragraph' };
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
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(textNode(input.slice(lastIndex, match.index)));
    }

    if (match[2] && match[3]) {
      nodes.push(
        textNode(match[2], [{ type: 'link', attrs: { href: match[3], target: '_blank' } }]),
      );
    } else if (match[4]) {
      nodes.push(textNode(match[4], [{ type: 'bold' }]));
    } else if (match[5]) {
      nodes.push(textNode(match[5], [{ type: 'italic' }]));
    } else if (match[6]) {
      nodes.push(textNode(match[6], [{ type: 'code' }]));
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
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: JSONContent[] = [];
  const paragraphBuffer: string[] = [];
  const listItems: JSONContent[] = [];
  let listKind: ListKind | null = null;
  let codeFence: { language: string | null; lines: string[] } | null = null;

  for (const line of lines) {
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
  return (node.content ?? []).map(inlineMarkdown).join('');
}

function nodeToMarkdown(node: JSONContent, index = 0): string {
  const text = inlineMarkdown(node);
  if (node.type === 'heading') {
    const level = typeof node.attrs?.level === 'number' ? Math.min(3, Math.max(1, node.attrs.level)) : 1;
    return `${'#'.repeat(level)} ${text}`;
  }
  if (node.type === 'paragraph') return text;
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
