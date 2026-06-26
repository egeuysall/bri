'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BriTiptapEditor } from '@/components/dashboard/tiptap-note-editor';
import type { NoteRecord, NoteVisibility } from '@/lib/notes';
import { normalizeMarkdownTables } from '@/lib/tiptap-markdown';

type NoteSlugEditorProps = {
  note: NoteRecord;
};

export function NoteSlugEditor({ note }: NoteSlugEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [visibility, setVisibility] = useState<NoteVisibility>(note.visibility);
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const nextTitle = title.trim();
    if (!nextTitle || !content.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/notes/by-id/${encodeURIComponent(note.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          title: nextTitle,
          content: normalizeMarkdownTables(content),
          visibility,
          expiresInDays: expiresInDays === 'never' ? null : Number(expiresInDays),
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || 'Failed to save note');
      }
      router.replace(`/${note.username}/${note.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="w-full px-4 py-5 md:px-8 md:py-8">
      <article className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">edit / {note.slug}</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-8 border border-neutral-800 text-xs"
              onClick={() => router.push(`/${note.username}/${note.slug}`)}
            >
              cancel
            </Button>
            <Button
              type="button"
              variant="default"
              className="h-8 text-xs"
              disabled={isSaving || !title.trim() || !content.trim()}
              onClick={() => void save()}
            >
              {isSaving ? 'saving' : 'save'}
            </Button>
          </div>
        </div>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-10 rounded-sm border border-neutral-800 bg-transparent px-3 text-sm text-neutral-100 outline-none transition-colors focus:border-neutral-600"
          maxLength={120}
          aria-label="Note title"
        />

        <div className="grid gap-2 md:grid-cols-[12rem_12rem_1fr]">
          <select
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value === 'private' ? 'private' : 'public')
            }
            className="h-8 rounded-sm border border-neutral-800 bg-transparent px-2 text-xs text-neutral-100"
            aria-label="Visibility"
          >
            <option value="public">public</option>
            <option value="private">private</option>
          </select>
          <select
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(event.target.value)}
            className="h-8 rounded-sm border border-neutral-800 bg-transparent px-2 text-xs text-neutral-100"
            aria-label="Expiration"
          >
            <option value="1">1d</option>
            <option value="7">7d</option>
            <option value="30">30d</option>
            <option value="never">never</option>
          </select>
          {error ? <p className="self-center text-xs text-red-400">{error}</p> : null}
        </div>

        <BriTiptapEditor
          value={content}
          onChange={setContent}
          placeholder="Edit note content..."
          minHeightClassName="min-h-[60vh]"
        />
      </article>
    </section>
  );
}
