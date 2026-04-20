import { notFound } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { UserDashboard } from '@/components/dashboard/user-dashboard';
import { normalizePathHandle, resolveUserHandle, resolveUserHandleFromUser } from '@/lib/user-handle';

export const revalidate = 0;

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { sessionClaims } = await auth();
  const user = await currentUser();
  let userHandle = resolveUserHandle(sessionClaims as Record<string, unknown> | null | undefined);

  if (!userHandle) {
    userHandle = resolveUserHandleFromUser(user);
  }

  if (!userHandle || normalizePathHandle(username) !== userHandle) {
    notFound();
  }

  return <UserDashboard />;
}
