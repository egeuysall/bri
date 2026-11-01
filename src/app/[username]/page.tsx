import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { notFound, redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { UserDashboard } from '@/components/dashboard/user-dashboard';
import { PublicProfileAvatar } from '@/components/public-profile-avatar';
import { PublicIbxFiles } from '@/components/public-ibx-files';
import { formatQuickLinkTitle } from '@/lib/quick-link-display';
import {
  getMyUserProfile,
  getPublicUserProfileByUsername,
  listPublicNotesByUsername,
  listQuickLinksByUsername,
} from '@/lib/notes';
import { listPublicIbxFiles } from '@/lib/public-ibx-files';
import { getSiteUrl } from '@/lib/site-url';
import { getBridgeApiKeySessionFromRequest } from '@/lib/request-security';
import {
  isPublicUsernamePath,
  normalizePathHandle,
  resolveUserHandle,
  resolveUserHandleFromUser,
} from '@/lib/user-handle';

export const revalidate = 0;
const PUBLIC_LIST_PAGE_SIZE = 5;

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [{ username }, query] = await Promise.all([params, searchParams]);
  if (!isPublicUsernamePath(username)) return { title: 'profile not found', robots: { index: false, follow: false } };
  const handle = normalizePathHandle(username);
  if (!handle) return { title: 'profile not found', robots: { index: false, follow: false } };

  const [profile, notes, links] = await Promise.all([
    getPublicUserProfileByUsername({ username: handle }).catch(() => null),
    listPublicNotesByUsername({ username: handle }).catch(() => []),
    listQuickLinksByUsername({ username: handle }).catch(() => []),
  ]);
  if (!profile && notes.length === 0 && links.length === 0) {
    return { title: 'profile not found', robots: { index: false, follow: false } };
  }

  const title = `@${handle}: public notes and links`;
  const description = `public notes and quick links from @${handle}.`;
  const canonicalQuery = new URLSearchParams();
  const notePage = parsePage(singleQueryParam(query.notePage));
  const linkPage = parsePage(singleQueryParam(query.linkPage));
  if (notePage > 1) canonicalQuery.set('notePage', String(notePage));
  if (linkPage > 1) canonicalQuery.set('linkPage', String(linkPage));
  const queryString = canonicalQuery.toString();
  const canonical = `${getSiteUrl()}/${encodeURIComponent(handle)}${queryString ? `?${queryString}` : ''}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: 'profile', url: canonical, title, description, siteName: 'bri' },
    twitter: { card: 'summary_large_image', title, description, images: ['/opengraph-image'] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  };
}

function singleQueryParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  const resolvedSearchParams = await searchParams;
  const forcePublicProfile = resolvedSearchParams.public === '1';
  if (!isPublicUsernamePath(username)) notFound();

  const normalizedPathHandle = normalizePathHandle(username);
  if (!normalizedPathHandle) notFound();
  if (normalizedPathHandle.startsWith('bri_demo_') && !forcePublicProfile) redirect('/');

  const { sessionClaims, userId, getToken } = await auth();
  let userHandle = resolveUserHandle(sessionClaims as Record<string, unknown> | null | undefined);
  let apiKeySession: Awaited<ReturnType<typeof getBridgeApiKeySessionFromRequest>> = null;

  if (!userHandle && userId) {
    const token = (await getToken({ template: 'convex' })) ?? (await getToken()) ?? null;
    if (token) {
      const profile = await getMyUserProfile({ token }).catch(() => null);
      if (profile?.username) {
        userHandle = normalizePathHandle(profile.username);
      }
    }
  }

  if (!userHandle && userId) {
    const user = await currentUser().catch(() => null);
    const fallbackHandle = resolveUserHandleFromUser(user);
    if (fallbackHandle) userHandle = fallbackHandle;
  }

  if (!userHandle) {
    const cookieHeader = (await headers()).get('cookie') ?? '';
    apiKeySession = await getBridgeApiKeySessionFromRequest(
      new Request('http://bri.local', { headers: { cookie: cookieHeader } })
    );
    if (apiKeySession?.username) userHandle = normalizePathHandle(apiKeySession.username);
  }

  if (!forcePublicProfile && userHandle && normalizedPathHandle === userHandle) {
    return <UserDashboard apiKeySession={Boolean(apiKeySession)} />;
  }

  const [profile, notes, links, publicFiles] = await Promise.all([
    getPublicUserProfileByUsername({ username: normalizedPathHandle }),
    listPublicNotesByUsername({ username: normalizedPathHandle }),
    listQuickLinksByUsername({ username: normalizedPathHandle }),
    listPublicIbxFiles(normalizedPathHandle),
  ]);

  if (!profile && notes.length === 0 && links.length === 0 && publicFiles.length === 0) {
    notFound();
  }

  const sortedNotes = [...notes].sort((a, b) => b.createdAt - a.createdAt);
  const sortedLinks = [...links].sort((a, b) => b.updatedAt - a.updatedAt);
  const notePages = Math.max(1, Math.ceil(sortedNotes.length / PUBLIC_LIST_PAGE_SIZE));
  const linkPages = Math.max(1, Math.ceil(sortedLinks.length / PUBLIC_LIST_PAGE_SIZE));
  const notePage = Math.min(parsePage(singleQueryParam(resolvedSearchParams.notePage)), notePages);
  const linkPage = Math.min(parsePage(singleQueryParam(resolvedSearchParams.linkPage)), linkPages);
  const visibleNotes = sortedNotes.slice(
    (notePage - 1) * PUBLIC_LIST_PAGE_SIZE,
    notePage * PUBLIC_LIST_PAGE_SIZE
  );
  const visibleLinks = sortedLinks.slice(
    (linkPage - 1) * PUBLIC_LIST_PAGE_SIZE,
    linkPage * PUBLIC_LIST_PAGE_SIZE
  );
  const filesDelay = 240 + visibleNotes.length * 55;
  const linksDelay = filesDelay + (publicFiles.length ? Math.min(publicFiles.length, 10) * 45 + 120 : 0);
  const pageHref = (nextNotePage: number, nextLinkPage: number) => {
    const params = new URLSearchParams();
    if (forcePublicProfile) params.set('public', '1');
    if (nextNotePage > 1) params.set('notePage', String(nextNotePage));
    if (nextLinkPage > 1) params.set('linkPage', String(nextLinkPage));
    const query = params.toString();
    return query ? `/${normalizedPathHandle}?${query}` : `/${normalizedPathHandle}`;
  };
  const profileUrl = `${getSiteUrl()}/${encodeURIComponent(normalizedPathHandle)}`;
  const profileJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: `@${normalizedPathHandle}`,
      alternateName: normalizedPathHandle,
      url: profileUrl,
      description: `Public notes and quick links from @${normalizedPathHandle}.`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd).replace(/</g, '\\u003c') }} />
      <section className="w-full px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-155 space-y-8">
        <header className="animate-enter flex flex-col items-start gap-3" style={{ '--delay': '40ms' } as CSSProperties}>
          <PublicProfileAvatar name={normalizedPathHandle} />
          <div className="space-y-2">
            <h1 className="text-base font-semibold text-neutral-100">
              @{normalizedPathHandle}
            </h1>
            <p className="text-xs text-neutral-500">
              {notes.length} published notes &middot; {links.length} links
            </p>
          </div>
        </header>

        <div className="space-y-3">
          <h2 className="animate-enter text-xs text-neutral-500" style={{ '--delay': '140ms' } as CSSProperties}>Published notes</h2>
          {notes.length === 0 ? (
            <p className="animate-enter text-xs text-neutral-500" style={{ '--delay': '200ms' } as CSSProperties}>No published notes.</p>
          ) : (
            visibleNotes.map((note, index) => (
              <Link
                key={note.id}
                href={`/${note.username}/${note.slug}`}
                className="animate-enter block rounded-sm border border-neutral-800 px-3 py-3 transition-colors hover:bg-neutral-900/85"
                style={{ '--delay': `${200 + index * 55}ms` } as CSSProperties}
              >
                <p className="text-sm text-neutral-100">{note.title}</p>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {new Date(note.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))
          )}
          {notePages > 1 ? (
            <div className="animate-enter flex items-center gap-3 text-xs text-neutral-400" style={{ '--delay': `${200 + visibleNotes.length * 55}ms` } as CSSProperties}>
              {notePage > 1 ? (
                <Link
                  href={pageHref(notePage - 1, linkPage)}
                  className="text-neutral-300 transition-colors hover:text-neutral-100"
                >
                  Previous
                </Link>
              ) : (
                <span className="text-neutral-600">Previous</span>
              )}
              <span>
                {notePage} / {notePages}
              </span>
              {notePage < notePages ? (
                <Link
                  href={pageHref(notePage + 1, linkPage)}
                  className="text-neutral-300 transition-colors hover:text-neutral-100"
                >
                  Next
                </Link>
              ) : (
                <span className="text-neutral-600">Next</span>
              )}
            </div>
          ) : null}
        </div>

        {publicFiles.length > 0 && <PublicIbxFiles files={publicFiles} startDelay={filesDelay} />}

        <div className="space-y-3">
          <h2 className="animate-enter text-xs text-neutral-500" style={{ '--delay': `${linksDelay}ms` } as CSSProperties}>Published links</h2>
          {links.length === 0 ? (
            <p className="animate-enter text-xs text-neutral-500" style={{ '--delay': `${linksDelay + 55}ms` } as CSSProperties}>No links yet.</p>
          ) : (
            visibleLinks.map((link, index) => (
              <a
                key={link.id}
                href={`/${link.username}/${link.key}`}
                className="animate-enter block rounded-sm border border-neutral-800 px-3 py-3 transition-colors hover:bg-neutral-900/85"
                style={{ '--delay': `${linksDelay + 55 + index * 55}ms` } as CSSProperties}
              >
                <p className="truncate text-sm text-neutral-100">
                  {formatQuickLinkTitle(link.label, link.key)}
                </p>
                <p className="mt-1 truncate text-[11px] text-neutral-500">{link.targetUrl}</p>
              </a>
            ))
          )}
          {linkPages > 1 ? (
            <div className="animate-enter flex items-center gap-3 text-xs text-neutral-400" style={{ '--delay': `${linksDelay + 55 + visibleLinks.length * 55}ms` } as CSSProperties}>
              {linkPage > 1 ? (
                <Link
                  href={pageHref(notePage, linkPage - 1)}
                  className="text-neutral-300 transition-colors hover:text-neutral-100"
                >
                  Previous
                </Link>
              ) : (
                <span className="text-neutral-600">Previous</span>
              )}
              <span>
                {linkPage} / {linkPages}
              </span>
              {linkPage < linkPages ? (
                <Link
                  href={pageHref(notePage, linkPage + 1)}
                  className="text-neutral-300 transition-colors hover:text-neutral-100"
                >
                  Next
                </Link>
              ) : (
                <span className="text-neutral-600">Next</span>
              )}
            </div>
          ) : null}
        </div>
        </div>
      </section>
    </>
  );
}
