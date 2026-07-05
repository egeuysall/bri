'use client';

import { useEffect, useMemo, useRef, type ChangeEvent, type ReactNode } from 'react';
import type { Editor, JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { Mathematics } from '@tiptap/extension-mathematics';
import {
  Bold,
  Code2,
  Heading1,
  ImageIcon,
  Italic,
  LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Paperclip,
  Redo2,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  markdownToTiptapDocument,
  normalizeMarkdownTables,
  tiptapDocumentToMarkdown,
} from '@/lib/tiptap-markdown';

type BriTiptapEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
};

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactNode;
};

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function editorMarkdown(editor: Editor) {
  return tiptapDocumentToMarkdown(editor.getJSON() as JSONContent);
}

const MARKDOWN_SEPARATOR_ROW = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/;

function parseMarkdownTable(text: string): JSONContent | null {
  const lines = normalizeMarkdownTables(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const headerIndex = lines.findIndex(
    (line, index) =>
      index < lines.length - 1 &&
      line.includes('|') &&
      MARKDOWN_SEPARATOR_ROW.test(lines[index + 1] ?? '')
  );
  if (headerIndex < 0) return null;
  const rows = lines
    .slice(headerIndex)
    .filter((line) => line.includes('|'))
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
        content: [
          {
            type: 'paragraph',
            content: row[index] ? [{ type: 'text', text: row[index] }] : undefined,
          },
        ],
      })),
    })),
  };
}

function ToolbarButton({ label, active, disabled, onClick, icon }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`h-7 w-7 border border-neutral-800 p-0 text-neutral-300 hover:text-neutral-50 ${
        active ? 'bg-neutral-800 text-neutral-50' : ''
      }`}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}

export function BriTiptapEditor({
  value,
  onChange,
  placeholder = 'Write your note...',
  minHeightClassName = 'min-h-[18rem]',
}: BriTiptapEditorProps) {
  const lastExternalValueRef = useRef(value);
  const lastEmittedValueRef = useRef(value);
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initialContent = useMemo(() => markdownToTiptapDocument(value), []);

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;
        const normalized = normalizeMarkdownTables(text);
        const table = parseMarkdownTable(normalized);
        const hasMath = /\$[^$\n]+\$|\$\$/.test(normalized);
        if (!table && !hasMath && normalized === text) return false;
        event.preventDefault();
        const doc = markdownToTiptapDocument(normalized);
        editorRef.current?.chain().focus().insertContent(doc.content ?? []).run();
        return true;
      },
    },
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Mathematics.configure({
        katexOptions: { output: 'mathml', throwOnError: false },
      }),
      Image,
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    onUpdate: ({ editor: nextEditor }) => {
      const nextMarkdown = editorMarkdown(nextEditor);
      lastEmittedValueRef.current = nextMarkdown;
      onChange(nextMarkdown);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (value === lastExternalValueRef.current || value === lastEmittedValueRef.current) {
      lastExternalValueRef.current = value;
      return;
    }
    if (editor.isFocused) return;

    editor.commands.setContent(markdownToTiptapDocument(value), { emitUpdate: false });
    lastExternalValueRef.current = value;
    lastEmittedValueRef.current = value;
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className={`${minHeightClassName} rounded-sm border border-neutral-800 bg-transparent p-3`}
      />
    );
  }

  const setLink = () => {
    const previousHref = editor.getAttributes('link').href;
    const rawHref = window.prompt('Link URL', typeof previousHref === 'string' ? previousHref : '');
    if (rawHref === null) return;
    const href = rawHref.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (!isSafeHttpUrl(href)) {
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const insertImage = () => {
    const rawSrc = window.prompt('Image URL');
    if (rawSrc === null) return;
    const src = rawSrc.trim();
    if (!isSafeHttpUrl(src)) return;
    editor.chain().focus().setImage({ src }).run();
  };

  const attachImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;

    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
    if (!src.startsWith('data:image/')) return;
    editor.chain().focus().setImage({ src, alt: file.name }).run();
  };

  return (
    <div className="rounded-sm border border-neutral-800 bg-transparent">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void attachImage(event);
        }}
      />
      <div className="flex flex-wrap gap-1 border-b border-neutral-800 p-2">
        <ToolbarButton
          label="Heading"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          icon={<Heading1 className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          icon={<Bold className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          icon={<Italic className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Link"
          active={editor.isActive('link')}
          onClick={setLink}
          icon={<LinkIcon className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Image"
          active={editor.isActive('image')}
          onClick={insertImage}
          icon={<ImageIcon className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Attach image"
          active={editor.isActive('image')}
          onClick={() => fileInputRef.current?.click()}
          icon={<Paperclip className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Table"
          active={editor.isActive('table')}
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          icon={<ListChecks className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          icon={<List className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Ordered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          icon={<ListOrdered className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Task list"
          active={editor.isActive('taskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          icon={<ListChecks className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Code block"
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          icon={<Code2 className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          icon={<Undo2 className="h-3.5 w-3.5" />}
        />
        <ToolbarButton
          label="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          icon={<Redo2 className="h-3.5 w-3.5" />}
        />
      </div>
      <EditorContent
        editor={editor}
        className={`bri-tiptap-editor ${minHeightClassName} p-3 text-sm text-neutral-200`}
      />
    </div>
  );
}
