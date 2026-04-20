'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AppSidebar, type DashboardPanel } from '@/components/app-sidebar';
import { CodeBlock } from '@/components/markdown/code-block';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

type NoteRecord = {
  id: string;
  username: string;
  slug: string;
  title: string;
  visibility: 'public' | 'private';
  createdAt: number;
  expiresAt: number | null;
  deletedAt: number | null;
  purgeAt: number | null;
};

type ApiKeyRecord = {
  id: string;
  prefix: string;
  permissions: 'read' | 'write' | 'read_write';
  label: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
};

function formatDate(value: number | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function UserDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromQuery = searchParams.get('tab');
  const initialPanel: DashboardPanel =
    tabFromQuery === 'notes' ||
    tabFromQuery === 'new' ||
    tabFromQuery === 'settings' ||
    tabFromQuery === 'deleted'
      ? tabFromQuery
      : 'notes';
  const PAGE_SIZE = 10;
  const visibilityOptions = [
    { value: 'public', label: 'public' },
    { value: 'private', label: 'private' },
  ] as const;
  const expirationOptions = [
    { value: '1h', label: '1 hour', days: 1 / 24 },
    { value: '6h', label: '6 hours', days: 6 / 24 },
    { value: '1d', label: '1 day', days: 1 },
    { value: '7d', label: '7 days', days: 7 },
    { value: '30d', label: '30 days', days: 30 },
  ] as const;
  const permissionOptions = [
    { value: 'read', label: 'read' },
    { value: 'write', label: 'write' },
    { value: 'read_write', label: 'read + write' },
  ] as const;

  const [panel, setPanel] = useState<DashboardPanel>(initialPanel);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<NoteRecord[]>([]);
  const [notesPage, setNotesPage] = useState<number>(1);
  const [deletedPage, setDeletedPage] = useState<number>(1);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [generatedApiKey, setGeneratedApiKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [content, setContent] = useState<string>('# Hello');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [expirationValue, setExpirationValue] =
    useState<(typeof expirationOptions)[number]['value']>('30d');

  const [keyLabel, setKeyLabel] = useState<string>('cli');
  const [keyPermissions, setKeyPermissions] = useState<'read' | 'write' | 'read_write'>('read');

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const cliInstallCommand = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `curl -fsSL ${window.location.origin}/install.sh | bash`;
    }
    return 'curl -fsSL https://bri.egeuysal.com/install.sh | bash';
  }, []);
  const notePages = Math.max(1, Math.ceil(notes.length / PAGE_SIZE));
  const deletedPages = Math.max(1, Math.ceil(deletedNotes.length / PAGE_SIZE));
  const visibleNotes = useMemo(
    () => notes.slice((notesPage - 1) * PAGE_SIZE, notesPage * PAGE_SIZE),
    [notes, notesPage]
  );
  const visibleDeletedNotes = useMemo(
    () => deletedNotes.slice((deletedPage - 1) * PAGE_SIZE, deletedPage * PAGE_SIZE),
    [deletedNotes, deletedPage]
  );

  async function fetchNotes(state: 'active' | 'deleted') {
    const response = await fetch(`/api/notes?state=${state}`);
    if (!response.ok) {
      throw new Error('Failed to fetch notes');
    }

    const json = (await response.json()) as { data?: NoteRecord[] };
    return json.data ?? [];
  }

  async function refreshData() {
    setLoading(true);
    setError('');
    try {
      const [active, deleted] = await Promise.all([fetchNotes('active'), fetchNotes('deleted')]);
      setNotes(active);
      setDeletedNotes(deleted);
      setNotesPage(1);
      setDeletedPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function refreshApiKeys(options?: { clearGenerated?: boolean }) {
    if (options?.clearGenerated !== false) {
      // Generated key is one-time reveal only; never keep showing it after refetch/reload.
      setGeneratedApiKey('');
    }
    const response = await fetch('/api/keys');
    if (!response.ok) {
      throw new Error('Failed to fetch api keys');
    }

    const json = (await response.json()) as { data?: ApiKeyRecord[] };
    setApiKeys((json.data ?? []).filter((item) => item.revokedAt === null));
  }

  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab === panel) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', panel);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [panel, pathname, router, searchParams]);

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    if (panel === 'settings') {
      void refreshApiKeys().catch(() => {
        setError('Failed to fetch api keys');
      });
    }
  }, [panel]);

  function wrapSelection(prefix: string, suffix = prefix, selectInner = false) {
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const next = `${textarea.value.slice(0, start)}${prefix}${selected}${suffix}${textarea.value.slice(end)}`;
    setContent(next);
    queueMicrotask(() => {
      textarea.focus();
      const selectionStart = start + prefix.length;
      const selectionEnd = selectInner ? start + prefix.length + selected.length : selectionStart;
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function insertHeading() {
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const withPrefix = selected.startsWith('# ') ? selected : `# ${selected}`;
    const next = `${textarea.value.slice(0, start)}${withPrefix}${textarea.value.slice(end)}`;
    setContent(next);
    queueMicrotask(() => {
      textarea.focus();
      const base = start + 2;
      const cursor = selected.length > 0 ? base + selected.length : base;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function createNote() {
    setError('');
    setGeneratedApiKey('');

    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        visibility,
        expiresInDays:
          expirationOptions.find((option) => option.value === expirationValue)?.days ?? 30,
      }),
    });

    const json = (await response.json()) as {
      error?: string;
      data?: { username: string; slug: string };
    };

    if (!response.ok) {
      throw new Error(json.error || 'Failed to create note');
    }

    setPanel('notes');
    setContent('# Hello');
    setExpirationValue('30d');
    await refreshData();
  }

  async function patchNote(noteId: string, action: 'softDelete' | 'restore' | 'permanentDelete') {
    const response = await fetch(`/api/notes/by-id/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(json.error || 'Failed to update note');
    }

    await refreshData();
  }

  async function generateApiKey() {
    setError('');
    setGeneratedApiKey('');

    const response = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissions: keyPermissions,
        label: keyLabel,
      }),
    });

    const json = (await response.json()) as { error?: string; data?: { key?: string } };
    if (!response.ok) {
      throw new Error(json.error || 'Failed to generate api key');
    }

    setGeneratedApiKey(json.data?.key || '');
    setKeyLabel('cli');
    await refreshApiKeys({ clearGenerated: false });
  }

  async function revokeKey(keyId: string) {
    const response = await fetch(`/api/keys/${keyId}`, { method: 'DELETE' });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(json.error || 'Failed to revoke key');
    await refreshApiKeys();
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar panel={panel} onPanelChange={setPanel} />
      <SidebarInset className="min-h-screen bg-bg">
        <section className="w-full px-6 py-8 md:px-10">
          <div className="mx-auto w-full max-w-6xl space-y-5">
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            {loading ? <p className="text-xs text-neutral-500">Loading...</p> : null}

            {panel === 'notes' ? (
              <div className="space-y-3">
                <h1 className="text-sm text-neutral-200">Your notes</h1>
                {notes.length === 0 ? (
                  <p className="text-xs text-neutral-500">No notes yet.</p>
                ) : null}
                {visibleNotes.map((note) => (
                  <article
                    key={note.id}
                    className="flex items-center justify-between gap-3 rounded-sm border border-neutral-900 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/${note.username}/${note.slug}`}
                        className="text-sm text-neutral-100 hover:underline"
                      >
                        {note.title}
                      </Link>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        /{note.username}/{note.slug} &middot; {note.visibility} &middot; created{' '}
                        {formatDate(note.createdAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 border border-neutral-800 text-xs"
                      onClick={() => {
                        void patchNote(note.id, 'softDelete').catch((err) =>
                          setError(err instanceof Error ? err.message : 'Failed to delete note')
                        );
                      }}
                    >
                      Delete
                    </Button>
                  </article>
                ))}
                {notes.length > PAGE_SIZE ? (
                  <Pagination className="justify-start">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setNotesPage((prev) => Math.max(1, prev - 1))}
                          disabled={notesPage <= 1}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-2 text-xs text-neutral-400">
                          {notesPage} / {notePages}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setNotesPage((prev) => Math.min(notePages, prev + 1))}
                          disabled={notesPage >= notePages}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </div>
            ) : null}

            {panel === 'new' ? (
              <div className="space-y-4">
                <h1 className="text-sm text-neutral-200">New note</h1>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 border border-neutral-800 text-xs"
                    onClick={insertHeading}
                  >
                    H1
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 border border-neutral-800 text-xs"
                    onClick={() => wrapSelection('**', '**', true)}
                  >
                    Bold
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 border border-neutral-800 text-xs"
                    onClick={() => wrapSelection('*', '*', true)}
                  >
                    Italic
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 border border-neutral-800 text-xs"
                    onClick={() => wrapSelection('`', '`', true)}
                  >
                    Inline Code
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 border border-neutral-800 text-xs"
                    onClick={() => wrapSelection('\n```md\n', '\n```\n', true)}
                  >
                    Code Block
                  </Button>
                </div>

                <textarea
                  ref={editorRef}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="min-h-[22rem] w-full rounded-sm border border-neutral-800 bg-transparent p-3 text-sm text-neutral-200 outline-none focus:border-neutral-600"
                />

                <div className="flex flex-col gap-3 text-xs">
                  <label className="flex flex-col gap-1">
                    <span>Visibility</span>
                    <Combobox
                      items={[...visibilityOptions]}
                      value={visibility}
                      onValueChange={(next) =>
                        setVisibility(next === 'private' ? 'private' : 'public')
                      }
                    >
                      <ComboboxInput placeholder="Visibility" className="w-56" />
                      <ComboboxContent>
                        <ComboboxEmpty>No visibility found.</ComboboxEmpty>
                        <ComboboxList>
                          <ComboboxGroup>
                            {visibilityOptions.map((option) => (
                              <ComboboxItem key={option.value} value={option.value}>
                                {option.label}
                              </ComboboxItem>
                            ))}
                          </ComboboxGroup>
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Expire in</span>
                    <Combobox
                      items={[...expirationOptions]}
                      value={expirationValue}
                      onValueChange={(value) => {
                        const next = expirationOptions.find((option) => option.value === value);
                        if (next) setExpirationValue(next.value);
                      }}
                    >
                      <ComboboxInput placeholder="Expiration" className="w-56" />
                      <ComboboxContent>
                        <ComboboxEmpty>No duration found.</ComboboxEmpty>
                        <ComboboxList>
                          <ComboboxGroup>
                            {expirationOptions.map((option) => (
                              <ComboboxItem key={option.value} value={option.value}>
                                {option.label}
                              </ComboboxItem>
                            ))}
                          </ComboboxGroup>
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </label>

                  <Button
                    type="button"
                    className="h-8 border border-neutral-100 bg-neutral-100 text-xs text-neutral-950 hover:bg-neutral-200 hover:text-neutral-950"
                    onClick={() => {
                      void createNote().catch((err) =>
                        setError(err instanceof Error ? err.message : 'Failed to create note')
                      );
                    }}
                  >
                    Publish
                  </Button>
                </div>
              </div>
            ) : null}

            {panel === 'settings' ? (
              <div className="space-y-4">
                <h1 className="text-sm text-neutral-200">Settings</h1>

                <div className="rounded-sm border border-neutral-900 p-3">
                  <p className="text-xs text-neutral-500">CLI install command</p>
                  <CodeBlock className="mt-2" language="bash">
                    {cliInstallCommand}
                  </CodeBlock>
                </div>

                <div className="rounded-sm border border-neutral-900 p-3">
                  <p className="text-xs text-neutral-500">Generate API key</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input
                      value={keyLabel}
                      onChange={(event) => setKeyLabel(event.target.value)}
                      placeholder="label"
                      className="h-8 rounded-sm border border-neutral-800 bg-transparent px-2 text-xs"
                    />
                    <Combobox
                      items={[...permissionOptions]}
                      value={keyPermissions}
                      onValueChange={(value) => {
                        if (value === 'read' || value === 'write' || value === 'read_write') {
                          setKeyPermissions(value);
                        }
                      }}
                    >
                      <ComboboxInput placeholder="Permissions" className="w-48" />
                      <ComboboxContent>
                        <ComboboxEmpty>No permission found.</ComboboxEmpty>
                        <ComboboxList>
                          <ComboboxGroup>
                            {permissionOptions.map((option) => (
                              <ComboboxItem key={option.value} value={option.value}>
                                {option.label}
                              </ComboboxItem>
                            ))}
                          </ComboboxGroup>
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    <Button
                      type="button"
                      className="h-8 text-xs"
                      onClick={() => {
                        void generateApiKey().catch((err) =>
                          setError(err instanceof Error ? err.message : 'Failed to generate key')
                        );
                      }}
                    >
                      Generate
                    </Button>
                  </div>

                  {generatedApiKey ? (
                    <div className="mt-3 rounded-sm border border-neutral-900 p-2">
                      <p className="text-[11px] text-neutral-300">
                        Save this now, it is shown once:
                      </p>
                      <CodeBlock className="mt-1" language="text">
                        {generatedApiKey}
                      </CodeBlock>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-sm border border-neutral-900 p-3">
                  <p className="text-xs text-neutral-500">Your API keys</p>
                  <div className="mt-2 space-y-2">
                    {apiKeys.length === 0 ? (
                      <p className="text-xs text-neutral-500">No API keys yet.</p>
                    ) : null}
                    {apiKeys.map((key) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between gap-2 rounded-sm border border-neutral-900 px-2 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs text-neutral-200">{key.label || 'api key'}</p>
                          <p className="text-[11px] text-neutral-500">
                            {key.permissions} &middot; created {formatDate(key.createdAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 border border-neutral-800 text-xs"
                          onClick={() => {
                            void revokeKey(key.id).catch((err) =>
                              setError(err instanceof Error ? err.message : 'Failed to revoke key')
                            );
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {panel === 'deleted' ? (
              <div className="space-y-3">
                <h1 className="text-sm text-neutral-200">Recently deleted</h1>
                {deletedNotes.length === 0 ? (
                  <p className="text-xs text-neutral-500">No recently deleted notes.</p>
                ) : null}
                {visibleDeletedNotes.map((note) => (
                  <article
                    key={note.id}
                    className="flex items-center justify-between gap-3 rounded-sm border border-neutral-900 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-200">{note.title}</p>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        deleted {formatDate(note.deletedAt)} &middot; permanent delete{' '}
                        {formatDate(note.purgeAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 border border-neutral-800 text-xs"
                        onClick={() => {
                          void patchNote(note.id, 'restore').catch((err) =>
                            setError(err instanceof Error ? err.message : 'Failed to restore note')
                          );
                        }}
                      >
                        Restore
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 border border-neutral-800 text-xs text-red-300"
                        onClick={() => {
                          void patchNote(note.id, 'permanentDelete').catch((err) =>
                            setError(
                              err instanceof Error
                                ? err.message
                                : 'Failed to permanently delete note'
                            )
                          );
                        }}
                      >
                        Delete forever
                      </Button>
                    </div>
                  </article>
                ))}
                {deletedNotes.length > PAGE_SIZE ? (
                  <Pagination className="justify-start">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setDeletedPage((prev) => Math.max(1, prev - 1))}
                          disabled={deletedPage <= 1}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-2 text-xs text-neutral-400">
                          {deletedPage} / {deletedPages}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setDeletedPage((prev) => Math.min(deletedPages, prev + 1))}
                          disabled={deletedPage >= deletedPages}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </SidebarInset>
    </SidebarProvider>
  );
}
