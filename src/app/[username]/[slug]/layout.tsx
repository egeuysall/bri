import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { getNoteByUsernameAndSlug } from '@/lib/notes';
import { getSiteUrl } from '@/lib/site-url';
import { noteDescription } from '@/lib/note-seo';
import { isPublicResourcePath, isPublicUsernamePath } from '@/lib/user-handle';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  if (!isPublicUsernamePath(username) || !isPublicResourcePath(slug)) {
    return {
      title: 'Note Not Found',
      description: 'The requested note could not be found.',
    };
  }

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

  const canonical = `${getSiteUrl()}/${note.username}/${note.slug}`;
  const description = noteDescription(note.content, 165, note.title);
  const image = `${canonical}/opengraph-image`;

  return {
    title: note.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: note.title,
      description,
      url: canonical,
      type: 'article',
      siteName: 'bri',
      locale: 'en_US',
      publishedTime: new Date(note.createdAt).toISOString(),
      modifiedTime: new Date(note.updatedAt).toISOString(),
      authors: [`@${note.username}`],
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: `${note.title} on bri`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: note.title,
      description,
      images: [image],
    },
  };
}

export default function NoteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
