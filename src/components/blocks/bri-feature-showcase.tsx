import type { CSSProperties } from 'react';
import { BriDemoNotes } from '@/components/blocks/bri-demo-notes';
import { listQuickLinksByUsername } from '@/lib/notes';

type LandingNote = { username: string; slug: string; title: string; href: string };
type LandingLink = { title: string; href: string; target: string };

async function getPublicNotes(): Promise<LandingNote[]> {
  try {
    const response = await fetch('https://bri.fyi/api/public/notes/egeuysall', { next: { revalidate: 300 } });
    if (!response.ok) return [];
    const payload = await response.json() as { data?: Array<{ username?: unknown; slug?: unknown; title?: unknown }> };
    return (payload.data ?? []).flatMap((note) => typeof note.username === 'string' && typeof note.slug === 'string' && typeof note.title === 'string'
      ? [{ username: note.username, slug: note.slug, title: note.title, href: `https://bri.fyi/${encodeURIComponent(note.username)}/${encodeURIComponent(note.slug)}` }]
      : []).slice(0, 4);
  } catch { return []; }
}

async function getPublicLinks(): Promise<LandingLink[]> {
  try {
    const rows = await listQuickLinksByUsername({ username: 'egeuysall' });
    return rows.flatMap((row) => {
      try {
        const target = new URL(row.targetUrl);
        return ['http:', 'https:'].includes(target.protocol)
          ? [{ title: row.label || row.key, href: `https://bri.fyi/${encodeURIComponent(row.username)}/${encodeURIComponent(row.key)}`, target: target.toString() }]
          : [];
      } catch { return []; }
    }).slice(0, 3);
  } catch { return []; }
}

export async function BriFeatureShowcase() {
  const [notes, links] = await Promise.all([getPublicNotes(), getPublicLinks()]);

  return (
    <section className="mt-8" aria-label="public notes and links">
      <div className="animate-enter" style={{ '--delay': '200ms' } as CSSProperties}>
        <BriDemoNotes initialNotes={notes} initialLinks={links} />
      </div>
    </section>
  );
}
