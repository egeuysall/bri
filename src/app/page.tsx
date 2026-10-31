import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { CliSection } from '@/components/blocks/cli-copy';
import { BriFeatureShowcase } from '@/components/blocks/bri-feature-showcase';
import { getBridgeApiKeySessionFromRequest } from '@/lib/request-security';
import { resolveUserHandle, resolveUserHandleFromUser } from '@/lib/user-handle';

const Landing = async () => {
  const { userId, sessionClaims } = await auth();

  if (userId) {
    const user = await currentUser();
    if (user?.publicMetadata.briLandingDemo !== true) {
      const handleFromClaims = resolveUserHandle(
        sessionClaims as Record<string, unknown> | null | undefined
      );
      const handle = handleFromClaims ?? resolveUserHandleFromUser(user);
      if (handle) redirect(`/${handle}`);
    }
  }

  const cookieHeader = (await headers()).get('cookie') ?? '';
  const apiKeySession = await getBridgeApiKeySessionFromRequest(
    new Request('http://bri.local', { headers: { cookie: cookieHeader } })
  );
  if (apiKeySession?.username) {
    redirect(`/${apiKeySession.username}`);
  }

  return (
    <>
      <section className="animate-enter" style={{ '--delay': '40ms' } as CSSProperties}>
        <h1 className="text-[13px] font-medium leading-relaxed text-neutral-200">
          open-source publishing for notes and links.
        </h1>
        <p className="mt-2 text-xs text-neutral-400">
          dashboard, api-first cli, private or public notes, built for fast sharing.
        </p>
      </section>

      <BriFeatureShowcase />
      <section
        className="mt-10 animate-enter pb-8"
        style={{ '--delay': '360ms' } as CSSProperties}
      >
        <CliSection />
      </section>
    </>
  );
};

export default Landing;
