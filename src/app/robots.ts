import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/wp-admin/',
          '/dashboard/',
          '/cpanel/',
          '/private/',
          '/includes/',
          '/cgi-bin/',
          '/tmp/',
          '/logs/',
          '/api/',
          '/sign-in/',
          '/sign-up/',
          '/*.json$',
          '/*.sql$',
          '/*.yml$',
          '/*.config$',
          '/*.env$',
          '/*.log$',
        ],
      },
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: [
          '/admin/',
          '/wp-admin/',
          '/dashboard/',
          '/cpanel/',
          '/private/',
          '/includes/',
          '/cgi-bin/',
          '/tmp/',
          '/logs/',
          '/api/',
          '/sign-in/',
          '/sign-up/',
        ],
      },
      {
        userAgent: 'AdsBot-Google',
        allow: '/',
      },
      {
        userAgent: 'Slurp',
        allow: '/',
        crawlDelay: 5,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl.replace(/^https?:\/\//, ''),
  };
}
