'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { NoteRecord } from '@/lib/notes';

type Folder = { id: string; name: string; parentFolderId: string | null };

export function PublicNotesBrowser({ notes, folders }: { notes: NoteRecord[]; folders: Folder[] }) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [terminalFolderId, setTerminalFolderId] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const byId = useMemo(() => new Map(folders.map(folder => [folder.id, folder])), [folders]);
  const children = (parent: string | null) => folders.filter(folder => (folder.parentFolderId ?? null) === parent).sort((a, b) => a.name.localeCompare(b.name));
  const noteChildren = (parent: string | null) => notes.filter(note => (note.folderId && byId.has(note.folderId) ? note.folderId : null) === parent).sort((a, b) => a.title.localeCompare(b.title));
  const breadcrumb: Folder[] = [];
  for (let id = folderId; id && byId.has(id); id = byId.get(id)?.parentFolderId ?? null) breadcrumb.unshift(byId.get(id)!);
  const terminalPath: string[] = [];
  for (let id = terminalFolderId; id && byId.has(id); id = byId.get(id)?.parentFolderId ?? null) terminalPath.unshift(byId.get(id)!.name);
  const rows = [...children(folderId).map(folder => ({ kind: 'folder' as const, folder })), ...noteChildren(folderId).map(note => ({ kind: 'note' as const, note }))];
  const navigate = (id: string | null) => setFolderId(id);
  const tree = (parent: string | null, depth = 0): string[] => [
    ...children(parent).flatMap(folder => [`${'  '.repeat(depth)}├── ${folder.name}/`, ...tree(folder.id, depth + 1)]),
    ...noteChildren(parent).map(note => `${'  '.repeat(depth)}├── ${note.title}`),
  ];
  const resolveFolder = (value: string) => {
    let id = value.startsWith('/') || /^notes(?=\/|$)/.test(value) ? null : terminalFolderId;
    for (const segment of value.replace(/^\/?notes(?=\/|$)\/?/, '').split('/').filter(Boolean)) {
      if (segment === '.') continue;
      if (segment === '..') { id = id ? byId.get(id)?.parentFolderId ?? null : null; continue; }
      const folder = children(id).find(item => item.name === segment);
      if (!folder) return undefined;
      id = folder.id;
    }
    return id;
  };
  const run = (event: FormEvent) => {
    event.preventDefault();
    const input = command.trim();
    if (!input) return;
    const [verb, ...args] = input.split(/\s+/);
    const arg = args.join(' ');
    let output: string[];
    if (verb === 'clear') { setHistory(['']); setCommand(''); return; }
    if (verb === 'help') output = ['help, pwd, ls, tree, cd <folder>, open <note>, clear'];
    else if (verb === 'pwd') output = [`/notes${terminalPath.length ? `/${terminalPath.join('/')}` : ''}`];
    else if (verb === 'cd') {
      const target = arg ? resolveFolder(arg) : null;
      output = target === undefined ? [`Folder not found: ${arg}`] : [];
      if (target !== undefined) setTerminalFolderId(target);
    } else if (verb === 'ls') output = [...children(terminalFolderId).map(folder => `${folder.name}/`), ...noteChildren(terminalFolderId).map(note => note.title)];
    else if (verb === 'tree') output = ['notes/', ...tree(terminalFolderId)];
    else if (verb === 'open') {
      const slash = arg.lastIndexOf('/');
      const target = slash >= 0 ? resolveFolder(arg.slice(0, slash)) : terminalFolderId;
      const name = arg.slice(slash + 1);
      const note = target === undefined ? undefined : noteChildren(target).find(item => item.title === name || item.slug === name);
      if (note) window.open(`/${encodeURIComponent(note.username)}/${encodeURIComponent(note.slug)}`, '_blank', 'noopener,noreferrer');
      output = note ? [] : [`Note not found: ${arg}`];
    } else output = [`Unknown command: ${verb}`];
    setHistory(current => [...(current.length ? current : ['$ tree', 'notes/', ...tree(null)]), `$ ${input}`, ...(output.length ? output : [''])]);
    setCommand('');
  };

  return <div className="space-y-8">
    <section className="space-y-3">
      <h2 className="text-xs text-neutral-500">Terminal</h2>
      <div className="overflow-hidden rounded-sm border border-neutral-800 text-xs">
        <div className="flex justify-between border-b border-neutral-800 px-3 py-2 text-neutral-500"><span>bri terminal</span><span>public · read-only</span></div>
        <div className="max-h-72 overflow-y-auto px-3 py-3" aria-live="polite">
          <pre className="whitespace-pre-wrap break-words font-mono text-neutral-300">{history.length ? history.join('\n') : ['$ tree', 'notes/', ...tree(null)].join('\n')}</pre>
        </div>
        <form onSubmit={run} className="flex gap-2 border-t border-neutral-800 px-3 py-2"><span>$</span><input aria-label="Terminal command" className="min-w-0 flex-1 bg-transparent outline-none" value={command} onChange={event => setCommand(event.target.value)} placeholder="help, ls, tree, cd, open" /></form>
      </div>
    </section>
    <section className="space-y-3">
      <h2 className="text-xs text-neutral-500">Published notes</h2>
      <nav aria-label="Notes folder location" className="flex flex-wrap items-center gap-1 text-sm"><button onClick={() => navigate(null)} className="hover:underline">notes</button>{breadcrumb.map(folder => <span key={folder.id} className="flex items-center gap-1"><span className="text-neutral-500">/</span><button onClick={() => navigate(folder.id)} className="hover:underline">{folder.name}</button></span>)}</nav>
      <div className="divide-y divide-neutral-800 border-y border-neutral-800">
        {rows.map(row => row.kind === 'folder' ? <button key={row.folder.id} onClick={() => navigate(row.folder.id)} className="flex w-full gap-3 px-3 py-3 text-left text-sm hover:bg-neutral-900/85"><span aria-hidden="true">/</span>{row.folder.name}</button> : <Link key={row.note.id} href={`/${row.note.username}/${row.note.slug}`} className="flex gap-3 px-3 py-3 text-sm hover:bg-neutral-900/85"><span aria-hidden="true">-</span>{row.note.title}</Link>)}
      </div>
      {rows.length === 0 && <p className="text-xs text-neutral-500">No published notes here.</p>}
    </section>
  </div>;
}
