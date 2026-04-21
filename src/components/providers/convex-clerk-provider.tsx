'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function useConvexAuth() {
  const auth = useAuth();
  return {
    ...auth,
    getToken: (options?: Parameters<typeof auth.getToken>[0]) =>
      auth.getToken({ template: 'convex', ...options }),
  };
}

export function ConvexClerkProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useConvexAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
