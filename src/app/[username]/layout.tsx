import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { getPublicUserProfileByUsername } from '@/lib/notes';
import { normalizePathHandle, resolveUserHandle } from '@/lib/user-handle';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
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
