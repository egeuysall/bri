import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl().replace(/\/$/, '');
  let publicNotes: Array<{ username: string; slug: string; updatedAt?: number }> = [];
  try {
    const response = await fetch(`${base}/api/public/notes/egeuysall`, { next: { revalidate: 300 } });
    if (response.ok) {
      const payload = await response.json() as { data?: Array<{ username?: unknown; slug?: unknown; createdAt?: unknown }> };
      publicNotes = (payload.data ?? []).flatMap((note) => typeof note.username === 'string' && typeof note.slug === 'string'
        ? [{ username: note.username, slug: note.slug, ...(typeof note.createdAt === 'number' ? { updatedAt: note.createdAt } : {}) }]
        : []);
    }
  } catch { /* keep the homepage and docs available when the public notes API is unavailable */ }

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/docs`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/egeuysall`, changeFrequency: 'weekly', priority: 0.7 },
    ...publicNotes.map((note) => ({
      url: `${base}/${encodeURIComponent(note.username)}/${encodeURIComponent(note.slug)}`,
      ...(note.updatedAt ? { lastModified: new Date(note.updatedAt) } : {}),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
