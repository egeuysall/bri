'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Editor, JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import {
  Bold,
  Code2,
  Heading1,
  Italic,
  LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Redo2,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { markdownToTiptapDocument, tiptapDocumentToMarkdown } from '@/lib/tiptap-markdown';

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
  const initialContent = useMemo(() => markdownToTiptapDocument(value), []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
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

  return (
    <div className="rounded-sm border border-neutral-800 bg-transparent">
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
