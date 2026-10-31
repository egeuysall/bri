// Global CSS
import '@/styles/globals.css';

// External Libraries
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Fonts
import { geistMono } from '@/lib/fonts';
import { getSiteUrl } from '@/lib/site-url';

// Internal Components
import { SiteShell } from '@/components/layout/site-shell';
import { ConvexClerkProvider } from '@/components/providers/convex-clerk-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

// SEO details
import { getProduct } from '@/lib/site-details';

/**
 * The name of the site or application.
 * @type {string}
 */

// TODO: Fill these
export const name = 'bri';

/**
 * The main image URL for the site or application.
 * @type {string}
 */
export const image = '/logo.png';

/**
 * A brief description of the site or application.
 * @type {string}
 */
export const description = 'write and publish markdown notes and links. keep drafts private, share when ready, and manage everything with the cli, api, or dashboard.';

/**
 * The template string for dynamic page titles or metadata.
 * @type {string}
 */
const template = 'bri';

/**
 * The base URL of the site.
 * @type {string}
 */
const siteUrl = getSiteUrl();

/**
 * The name of the site's author.
 * @type {string}
 */
const authorName = 'Ege Uysal';

/**
 * An array of keywords relevant to the site for SEO purposes.
 * @type {string[]}
 */
const keywords: string[] = ['bri', 'markdown notes', 'publish markdown', 'private notes', 'share notes', 'markdown publishing', 'quick links', 'markdown cli', 'notes api'];

/**
 * The Twitter handle of the author (e.g., '@username').
 * @type {string}
 */
const authorTwitter = 'egecreates';

/**
 * The path or URL to the ICO favicon.
 * @type {string}
 */
const icoIcon = '/logo.svg';

/**
 * The path or URL to the PNG favicon.
 * @type {string}
 */
const pngIcon = '/logo.png';

/**
 * The path or URL to the Apple touch icon.
 * @type {string}
 */
const appleTouchIcon = '/logo.png';

export async function generateMetadata(): Promise<Metadata> {
  // Fetch data needed for metadata
  const product = await getProduct();
  const lowercaseName = product.name.toLowerCase();
  const lowercaseDescription = product.description.toLowerCase();
  const pageTitle = 'bri — markdown notes, links, and cli';
  return {
    title: {
      default: pageTitle,
      template: `%s | ${template}`,
    },
    description: lowercaseDescription,
    metadataBase: new URL(siteUrl),
    authors: [{ name: authorName }],
    creator: authorName,
    publisher: lowercaseName,
    keywords: keywords,
    category: 'productivity',
    referrer: 'strict-origin-when-cross-origin',
    openGraph: {
      title: pageTitle,
      description: lowercaseDescription,
      url: siteUrl,
      images: [{
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'bri — markdown notes, links, and cli',
      }],
      type: 'website',
      locale: 'en_US',
      siteName: lowercaseName,
    },
    twitter: {
      card: 'summary_large_image',
      site: `@${authorTwitter}`,
      title: pageTitle,
      description: lowercaseDescription,
      images: ['/opengraph-image'],
      creator: authorTwitter,
    },
    icons: {
      icon: [
        { url: icoIcon, sizes: 'any' },
        { url: pngIcon, type: 'image/png' },
      ],
      apple: appleTouchIcon,
      shortcut: icoIcon,
    },
    manifest: '/manifest.webmanifest',
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: siteUrl,
    },
    applicationName: product.name,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
    },
    other: {
      appleMobileWebAppCapable: 'yes',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const product = await getProduct();
  const enableVercelTelemetry = process.env.NEXT_PUBLIC_ENABLE_VERCEL_TELEMETRY === '1';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'bri',
        url: siteUrl,
        description: product.description,
        publisher: { '@type': 'Person', name: authorName, url: 'https://egeuysal.com' },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'bri',
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web, macOS, Linux, Windows',
        description: product.description,
        url: siteUrl,
        image: new URL('/opengraph-image', siteUrl).toString(),
        isAccessibleForFree: true,
        featureList: ['markdown notes', 'version history', 'public links', 'command line interface', 'api access'],
        author: { '@type': 'Person', name: authorName, url: 'https://egeuysal.com' },
      },
    ],
  };

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistMono.variable} h-full bg-bg`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      </head>
      <body className="min-h-full bg-bg font-mono text-fg antialiased">
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
          <ConvexClerkProvider>
            <TooltipProvider>
              <SiteShell>{children}</SiteShell>
            </TooltipProvider>
            <Toaster />
            {enableVercelTelemetry ? <Analytics /> : null}
            {enableVercelTelemetry ? <SpeedInsights /> : null}
          </ConvexClerkProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
