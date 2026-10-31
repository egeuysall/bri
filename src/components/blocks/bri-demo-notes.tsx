'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '@clerk/nextjs';

type NotePreview = { username: string; slug: string; title: string; href?: string; content?: string; temporary?: boolean };
type LandingLink = { title: string; href: string; target?: string };

export function BriDemoNotes({ initialNotes, initialLinks }: { initialNotes: NotePreview[]; initialLinks: LandingLink[] }) {
  const { getToken } = useAuth();
  const [notes, setNotes] = useState(initialNotes.slice(0, 3));
  const [links, setLinks] = useState(initialLinks.slice(0, 3));

  useEffect(() => {
    let active = true;
    const refresh = (event: Event) => {
      const sessionId = (event as CustomEvent<{ sessionId?: string }>).detail?.sessionId;
      if (!sessionId) return;
      void getToken({ template: 'convex' }).then((token) => fetch('/api/landing-cli', {
        cache: 'no-store',
        headers: { 'x-bri-demo-session': sessionId, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      }))
        .then(async (response) => response.ok ? await response.json() as { notes?: NotePreview[]; links?: LandingLink[] } : null)
        .then((payload) => {
          if (!active || !payload) return;
          if (payload.notes) setNotes(payload.notes.slice(0, 3));
          if (payload.links) setLinks(payload.links.slice(0, 3));
        })
        .catch(() => undefined);
    };
    window.addEventListener('bri:landing-workspace-updated', refresh);
    return () => {
      active = false;
      window.removeEventListener('bri:landing-workspace-updated', refresh);
    };
  }, [getToken]);

  return (
    <div className="bri-landing-notes flex flex-col gap-8">
      <section aria-labelledby="public-notes-title">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h3 id="public-notes-title" className="text-xs text-foreground">notes</h3>
          <span className="text-[11px] text-muted-foreground">{notes.length.toString().padStart(2, '0')}</span>
        </div>
        <ol className="divide-y divide-border text-[13px] leading-5">
          {notes.map((note, index) => (
            <li key={`${note.username}/${note.slug}`} className="animate-enter py-2.5" style={{ '--delay': `${300 + index * 55}ms` } as CSSProperties}>
              <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-2">
                <span className="text-[11px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                {note.temporary ? (
                  <details className="group min-w-0">
                    <summary className="list-none cursor-pointer truncate text-foreground hover:underline">{note.title}</summary>
                    <p className="mt-3 whitespace-pre-line text-xs leading-5 text-muted-foreground">{note.content || 'empty note'}</p>
                  </details>
                ) : (
                  <a href={note.href ?? `/${encodeURIComponent(note.username)}/${encodeURIComponent(note.slug)}`} className="min-w-0 truncate text-foreground hover:underline">
                    {note.title}
                  </a>
                )}
                <span className="text-[10px] text-muted-foreground">{note.temporary ? 'session' : 'public'}</span>
              </div>
            </li>
          ))}
          {notes.length === 0 && <li className="py-2.5 text-xs text-muted-foreground">no public notes</li>}
        </ol>
      </section>

      <section aria-labelledby="quick-links-title">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h3 id="quick-links-title" className="text-xs text-foreground">links</h3>
          <span className="text-[11px] text-muted-foreground">{links.length.toString().padStart(2, '0')}</span>
        </div>
        <ul className="divide-y divide-border text-[13px] leading-5">
          {links.map((item, index) => (
            <li key={`${item.href}-${index}`} className="animate-enter" style={{ '--delay': `${300 + notes.length * 55 + index * 55}ms` } as CSSProperties}>
              <a href={item.href} className="group grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-2 py-2.5 text-foreground">
                <span className="text-[11px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className="block truncate group-hover:underline">{item.title}</span>
                  {item.target && <span className="mt-1 block truncate text-[11px] text-muted-foreground">{item.target}</span>}
                </span>
              </a>
            </li>
          ))}
          {links.length === 0 && <li className="py-2.5 text-xs text-muted-foreground">no links</li>}
        </ul>
      </section>
    </div>
  );
}
