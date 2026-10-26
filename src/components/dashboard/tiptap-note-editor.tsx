'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { Editor, JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { useMutation } from 'convex/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { Image as ImageExtension } from '@tiptap/extension-image';
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
import { toast } from 'sonner';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  markdownToTiptapDocument,
  normalizeMarkdownTables,
  tiptapDocumentToMarkdown,
} from '@/lib/tiptap-markdown';
import { parseIBXFileMention } from '@/lib/ibx-file-mention';

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

type IBXFileMention = { from: number; to: number; query: string; left: number; top: number };

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

const MAX_IMAGE_FILE_BYTES = 20 * 1024 * 1024;
type IBXFile = { id: string; fileName: string; contentType: string; size: number; folderPath: string[]; url: string };

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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isIBXPickerOpen, setIsIBXPickerOpen] = useState(false);
  const [ibxUsername, setIBXUsername] = useState('');
  const [ibxFiles, setIBXFiles] = useState<IBXFile[]>([]);
  const [ibxCursor, setIBXCursor] = useState<string | null>(null);
  const [ibxError, setIBXError] = useState<string | null>(null);
  const [isLoadingIBXFiles, setIsLoadingIBXFiles] = useState(false);
  const [fileMention, setFileMention] = useState<IBXFileMention | null>(null);
  const fileMentionKeydownRef = useRef<{ first: IBXFile; insert: (file: IBXFile) => void } | null>(null);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const completeUpload = useMutation(api.files.completeUpload);
  const initialContent = useMemo(() => markdownToTiptapDocument(value), []);

  useEffect(() => {
    setIBXUsername(window.localStorage.getItem('ibx-username') ?? '');
  }, []);

  const updateFileMention = (nextEditor: Editor) => {
    const { selection } = nextEditor.state;
    if (!selection.empty) {
      setFileMention(null);
      return;
    }
    const parentOffset = selection.$from.parentOffset;
    const textBeforeCursor = selection.$from.parent.textBetween(0, parentOffset);
    const mention = parseIBXFileMention(textBeforeCursor);
    if (!mention) {
      setFileMention(null);
      return;
    }
    const caret = nextEditor.view.coordsAtPos(selection.from);
    const nextMention = {
      from: selection.from - parentOffset + mention.markerOffset,
      to: selection.from,
      query: mention.query,
      left: caret.left,
      top: caret.bottom,
    };
    setFileMention((current) =>
      current?.from === nextMention.from && current.to === nextMention.to && current.query === nextMention.query
        ? current
        : nextMention
    );
  };

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
      handleKeyDown: (_view, event) => {
        const mention = fileMentionKeydownRef.current;
        if (event.key !== 'Enter' || !mention) return false;
        event.preventDefault();
        mention.insert(mention.first);
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
      ImageExtension,
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    onUpdate: ({ editor: nextEditor }) => {
      updateFileMention(nextEditor);
      const nextMarkdown = editorMarkdown(nextEditor);
      lastEmittedValueRef.current = nextMarkdown;
      onChange(nextMarkdown);
    },
    onSelectionUpdate: ({ editor: nextEditor }) => updateFileMention(nextEditor),
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

  const loadIBXFiles = async (cursor?: string | null) => {
    const username = ibxUsername.trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(username)) {
      setIBXError('Enter a valid IBX username.');
      return;
    }
    setIsLoadingIBXFiles(true);
    setIBXError(null);
    if (!cursor) {
      setIBXFiles([]);
      setIBXCursor(null);
    }
    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const response = await fetch(`https://ibx.egeuysal.com/api/public/files/${encodeURIComponent(username)}${query}`, { cache: 'no-store' });
      const result = (await response.json()) as { files?: IBXFile[]; cursor?: string | null; error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not load public IBX files.');
      setIBXFiles((current) => cursor ? [...current, ...(result.files ?? [])] : result.files ?? []);
      setIBXCursor(result.cursor ?? null);
    } catch (error) {
      setIBXError(error instanceof Error ? error.message : 'Could not load public IBX files.');
    } finally {
      setIsLoadingIBXFiles(false);
    }
  };

  const insertIBXFile = (file: IBXFile, range = fileMention) => {
    try {
      const url = new URL(file.url);
      if (url.origin !== 'https://ibx.egeuysal.com') throw new Error('Invalid IBX file URL.');
      const chain = editor.chain().focus();
      if (range) chain.deleteRange({ from: range.from, to: range.to });
      if (file.contentType.startsWith('image/')) {
        chain.setImage({ src: url.href, alt: file.fileName }).run();
      } else {
        chain.insertContent([
          { type: 'text', text: file.fileName, marks: [{ type: 'link', attrs: { href: url.href } }] },
          { type: 'text', text: ' ' },
        ]).run();
      }
      setFileMention(null);
      setIsIBXPickerOpen(false);
    } catch (error) {
      setIBXError(error instanceof Error ? error.message : 'Could not insert this file.');
    }
  };

  const matchingIBXFiles = ibxFiles
    .filter((file) => `${file.fileName} ${file.folderPath.join('/')}`.toLowerCase().includes(fileMention?.query.toLowerCase() ?? ''))
    .slice(0, 50);
  fileMentionKeydownRef.current = fileMention && matchingIBXFiles[0]
    ? { first: matchingIBXFiles[0], insert: insertIBXFile }
    : null;

  const attachImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      toast.error('Images must be 20 MB or smaller');
      return;
    }

    setIsUploadingImage(true);
    try {
      const uploadUrl = await generateUploadUrl({
        contentType: file.type,
        size: file.size,
        name: file.name,
      });
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('Image upload failed');

      const uploadResult = (await uploadResponse.json()) as { storageId?: string };
      if (!uploadResult.storageId) throw new Error('Image upload returned no file id');

      await completeUpload({
        storageId: uploadResult.storageId as Id<'_storage'>,
        contentType: file.type,
        size: file.size,
        name: file.name,
      });

      editor
        .chain()
        .focus()
        .setImage({ src: `/api/files/${encodeURIComponent(uploadResult.storageId)}`, alt: file.name })
        .run();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
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
          label="IBX files"
          onClick={() => setIsIBXPickerOpen(true)}
          icon={<span className="text-[9px] font-semibold">ibx</span>}
        />
        <ToolbarButton
          label={isUploadingImage ? 'Uploading image' : 'Attach image'}
          active={editor.isActive('image')}
          disabled={isUploadingImage}
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
      <Dialog open={isIBXPickerOpen} onOpenChange={setIsIBXPickerOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto border-neutral-800 bg-neutral-950 text-neutral-100 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Public IBX files</DialogTitle>
            <DialogDescription className="text-neutral-400">Choose a file already shared publicly in IBX. Private files are never listed.</DialogDescription>
          </DialogHeader>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void loadIBXFiles(); }}>
            <Input aria-label="IBX username" placeholder="IBX username" value={ibxUsername} onChange={(event) => { setIBXUsername(event.target.value); window.localStorage.setItem('ibx-username', event.target.value); setIBXFiles([]); setIBXCursor(null); setIBXError(null); }} maxLength={64} className="border-neutral-800" />
            <Button type="submit" variant="outline" disabled={isLoadingIBXFiles}>{isLoadingIBXFiles ? 'loading' : 'load'}</Button>
          </form>
          {ibxError && <p role="alert" className="text-xs text-red-400">{ibxError}</p>}
          <div className="flex flex-col divide-y divide-neutral-800">
            {ibxFiles.map((file) => <button key={file.id} type="button" className="flex min-w-0 items-center justify-between gap-4 py-3 text-left hover:bg-neutral-900" onClick={() => insertIBXFile(file, null)}>
              <span className="min-w-0"><span className="block truncate text-sm">{file.fileName}</span><span className="block truncate text-xs text-neutral-500">{file.folderPath.join('/') || 'drive'} · {file.contentType}</span></span>
              <span className="shrink-0 text-xs text-neutral-400">insert</span>
            </button>)}
          </div>
          {!ibxFiles.length && !isLoadingIBXFiles && !ibxError && <p className="py-5 text-center text-xs text-neutral-500">Load a username to browse public files.</p>}
          {ibxCursor && <Button type="button" variant="outline" disabled={isLoadingIBXFiles} onClick={() => void loadIBXFiles(ibxCursor)}>load more</Button>}
        </DialogContent>
      </Dialog>
      {fileMention && <DropdownMenu open modal={false} onOpenChange={(open) => { if (!open) setFileMention(null); }}>
        <DropdownMenuTrigger render={<button type="button" tabIndex={-1} aria-hidden="true" className="pointer-events-none fixed h-px w-px opacity-0" style={{ left: fileMention.left, top: fileMention.top }} />} />
        <DropdownMenuContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="w-[min(42rem,calc(100vw-2rem))] max-h-[min(60vh,24rem)] border border-neutral-800 ring-0 [scrollbar-width:thin] [scrollbar-color:var(--muted-foreground)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/50"
          finalFocus={() => editor.view.dom}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && matchingIBXFiles[0]) {
              event.preventDefault();
              insertIBXFile(matchingIBXFiles[0]);
            } else if (event.key === 'Backspace') {
              event.preventDefault();
              const { from, to } = editor.state.selection;
              if (from !== to) editor.chain().focus().deleteSelection().run();
              else if (from > 1) editor.chain().focus().deleteRange({ from: from - 1, to: from }).run();
            } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
              event.preventDefault();
              editor.chain().focus().insertContent(event.key).run();
            }
          }}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>public IBX files</DropdownMenuLabel>
            {!ibxUsername.trim() ? <DropdownMenuItem onMouseDown={(event) => event.preventDefault()} onClick={() => setIsIBXPickerOpen(true)}>set IBX username</DropdownMenuItem>
              : isLoadingIBXFiles ? <DropdownMenuItem disabled>loading files…</DropdownMenuItem>
                : ibxError ? <DropdownMenuItem disabled>{ibxError}</DropdownMenuItem>
                  : !ibxFiles.length ? <DropdownMenuItem onMouseDown={(event) => event.preventDefault()} onClick={() => void loadIBXFiles()}>load public files</DropdownMenuItem>
                    : matchingIBXFiles.length ? matchingIBXFiles.map((file) => <DropdownMenuItem key={file.id} onMouseDown={(event) => event.preventDefault()} onClick={() => insertIBXFile(file)}>
                <span className="min-w-0 flex-1 whitespace-normal break-all">{file.fileName}</span><span className="max-w-[45%] shrink-0 whitespace-normal break-all text-right text-muted-foreground">{file.folderPath.join('/') || 'drive'}</span>
              </DropdownMenuItem>) : <DropdownMenuItem disabled>no matching public files</DropdownMenuItem>}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>}
      <EditorContent
        editor={editor}
        className={`bri-tiptap-editor ${minHeightClassName} p-3 text-sm text-neutral-200`}
      />
    </div>
  );
}
