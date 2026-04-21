// Global CSS
import '@/styles/globals.css';

// External Libraries
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Fonts
import { geistMono } from '@/lib/fonts';

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
export const name = 'bri: Share your Markdown files quickly and easily.';

/**
 * The main image URL for the site or application.
 * @type {string}
 */
export const image = 'logo.png';

/**
 * A brief description of the site or application.
 * @type {string}
 */
export const description = 'Share your Markdown files quickly and easily.';

/**
 * The template string for dynamic page titles or metadata.
 * @type {string}
 */
const template = 'bri';

/**
 * The base URL of the site.
 * @type {string}
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://bri.egeuysal.com');

/**
 * The name of the site's author.
 * @type {string}
 */
const authorName = 'Ege Uysal';

/**
 * An array of keywords relevant to the site for SEO purposes.
 * @type {string[]}
 */
const keywords: string[] = ['markdown', 'share', 'link', 'bri', 'egeuysal'];

/**
 * A description of the main image for accessibility and SEO.
 * @type {string}
 */
const imageDescription = 'bri Logo';

/**
 * The Twitter handle of the author (e.g., '@username').
 * @type {string}
 */
const authorTwitter = 'egecreates';

/**
 * The LinkedIn profile URL of the author.
 * @type {string}
 */
const authorLinkedin = 'egeuysall';

/**
 * The path or URL to the ICO favicon.
 * @type {string}
 */
const icoIcon = 'logo.svg';

/**
 * The path or URL to the PNG favicon.
 * @type {string}
 */
const pngIcon = 'logo.png';

/**
 * The path or URL to the Apple touch icon.
 * @type {string}
 */
const appleTouchIcon = 'logo.png';

export async function generateMetadata(): Promise<Metadata> {
  // Fetch data needed for metadata
  const product = await getProduct();
  return {
    title: {
      default: product.name,
      template: `%s | ${template}`,
    },
    description: product.description,
    metadataBase: new URL(siteUrl),
    authors: [{ name: authorName }],
    keywords: keywords,
    openGraph: {
      title: product.name,
      description: product.description,
      url: siteUrl,
      images: [
        {
          url: product.image,
          width: 1200,
          height: 630,
          alt: imageDescription,
        },
      ],
      type: 'website',
      locale: 'en_US',
      siteName: product.name,
    },
    twitter: {
      card: 'summary_large_image',
      site: product.name,
      title: product.name,
      description: product.description,
      images: [product.image],
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

  // Define date for product schema
  const priceValidUntilDate = new Date();
  priceValidUntilDate.setFullYear(priceValidUntilDate.getFullYear() + 1);
  const priceValidUntilString = priceValidUntilDate.toISOString().split('T')[0];

  // Format current date for schema (ISO format)
  const currentDate = new Date().toISOString();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: `${siteUrl}/${product.image}`,
    description: product.description,
    url: siteUrl,
    dateModified: currentDate,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: siteUrl,
      priceValidUntil: priceValidUntilString,
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '0',
          currency: 'USD',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: '0',
            maxValue: '0',
            unitCode: 'HUR',
          },
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'US',
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '127',
    },
    sameAs: [authorLinkedin, authorTwitter],
  };

  return (
    <html lang="en" suppressHydrationWarning className={`${geistMono.variable} h-full bg-bg`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
