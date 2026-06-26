import { auth, currentUser } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { NoteSlugEditor } from '@/components/dashboard/note-slug-editor';
import { getNoteByUsernameAndSlug } from '@/lib/notes';
import { resolveUserHandleFromUser } from '@/lib/user-handle';
import { isPublicResourcePath, isPublicUsernamePath } from '@/lib/user-handle';

export default async function EditNotePage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  if (!isPublicUsernamePath(username) || !isPublicResourcePath(slug)) notFound();

  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await currentUser();
  const handle = resolveUserHandleFromUser(user);
  if (handle !== username) notFound();

  const token = (await getToken({ template: 'convex' })) ?? (await getToken()) ?? null;
  const note = await getNoteByUsernameAndSlug({
    username,
    slug,
    apiKey: token,
    token,
  });

  if (!note || note.username !== handle) notFound();

  return <NoteSlugEditor note={note} />;
}
