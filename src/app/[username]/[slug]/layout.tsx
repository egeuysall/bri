import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { getNoteByUsernameAndSlug } from '@/lib/notes';

function shortDescription(text: string, maxLength = 165): string {
  const cleaned = text
    .replace(/[#*_~`>\[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  const trimmed = cleaned.slice(0, maxLength);
  const lastSpace = trimmed.lastIndexOf(' ');
  return `${trimmed.slice(0, lastSpace > 0 ? lastSpace : maxLength)}...`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  const { getToken } = await auth();
  const token = (await getToken({ template: 'convex' })) ?? (await getToken()) ?? null;

  const note = await getNoteByUsernameAndSlug({
    username,
    slug,
    apiKey: token,
    token,
  });

  if (!note) {
    return {
      title: 'Note Not Found',
      description: 'The requested note could not be found.',
    };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://bri.egeuysal.com');

  const canonical = `${siteUrl.replace(/\/$/, '')}/${note.username}/${note.slug}`;

  return {
    title: note.title,
    description: shortDescription(note.content),
    alternates: { canonical },
    openGraph: {
      title: note.title,
      description: shortDescription(note.content),
      url: canonical,
      type: 'article',
    },
  };
}

export default function NoteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
