import type { Metadata } from 'next';
import { auth, currentUser } from '@clerk/nextjs/server';
import { normalizePathHandle, resolveUserHandle, resolveUserHandleFromUser } from '@/lib/user-handle';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const { sessionClaims } = await auth();
  let userHandle = resolveUserHandle(sessionClaims as Record<string, unknown> | null | undefined);

  if (!userHandle) {
    const user = await currentUser();
    userHandle = resolveUserHandleFromUser(user);
  }

  if (userHandle && normalizePathHandle(username) === userHandle) {
    return {
      title: `${userHandle} Dashboard`,
      description: `Manage notes, API keys, and settings for @${userHandle}.`,
    };
  }

  return {
    title: 'Not Found',
    description: 'The requested page could not be found.',
  };
}

export default function UsernameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
