import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { getPublicUserProfileByUsername } from '@/lib/notes';
import { isPublicUsernamePath, normalizePathHandle, resolveUserHandle } from '@/lib/user-handle';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  if (!isPublicUsernamePath(username)) {
    return {
      title: 'Not Found',
      description: 'The requested page could not be found.',
    };
  }

  const { sessionClaims } = await auth();
  const userHandle = resolveUserHandle(sessionClaims as Record<string, unknown> | null | undefined);

  if (userHandle && normalizePathHandle(username) === userHandle) {
    return {
      title: `${userHandle} Dashboard`,
      description: `Manage notes, API keys, and settings for @${userHandle}.`,
    };
  }

  const normalized = normalizePathHandle(username);
  if (normalized) {
    const profile = await getPublicUserProfileByUsername({ username: normalized });
    if (profile) {
      return {
        title: `${profile.displayName ? `${profile.displayName} ` : ''}@${profile.username}`,
        description: profile.email
          ? `Published notes and links for @${profile.username} (${profile.email}).`
          : `Published notes and links for @${profile.username}.`,
      };
    }
  }

  return {
    title: `@${username}`,
    description: `Published notes and links for @${username}.`,
  };
}

export default function UsernameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
