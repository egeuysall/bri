import { describe, expect, test } from 'bun:test';
import { markdownToTiptapDocument, tiptapDocumentToMarkdown } from './tiptap-markdown';

describe('tiptap markdown compatibility', () => {
  test('round-trips inline and display math', () => {
    const markdown = 'Euler: $e^{i\\pi} + 1 = 0$.\n\n$$\\int_0^1 x^2 \\, dx$$';

    const document = markdownToTiptapDocument(markdown);

    expect(document.content?.[0]?.content?.[1]).toEqual({
      type: 'inlineMath',
      attrs: { latex: 'e^{i\\pi} + 1 = 0' },
    });
    expect(document.content?.[1]).toEqual({
      type: 'blockMath',
      attrs: { latex: '\\int_0^1 x^2 \\, dx' },
    });
    expect(tiptapDocumentToMarkdown(document)).toBe(markdown);
  });

  test('round-trips common note markdown blocks', () => {
    const markdown = [
      '# Launch note',
      '',
      'Ship **offline** editor with [IBX](https://ibx.egeuysal.com).',
      '',
      '- first item',
      '- second item',
      '',
      '1. ordered item',
      '2. next ordered item',
      '',
      '- [x] done task',
      '- [ ] open task',
      '',
      '```ts',
      'const value = 1;',
      '```',
    ].join('\n');

    const document = markdownToTiptapDocument(markdown);
    const nextMarkdown = tiptapDocumentToMarkdown(document);

    expect(nextMarkdown).toContain('# Launch note');
    expect(nextMarkdown).toContain('**offline**');
    expect(nextMarkdown).toContain('[IBX](https://ibx.egeuysal.com)');
    expect(nextMarkdown).toContain('- first item');
    expect(nextMarkdown).toContain('1. ordered item');
    expect(nextMarkdown).toContain('- [x] done task');
    expect(nextMarkdown).toContain('```ts');
  });
});
