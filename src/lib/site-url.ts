export const DEFAULT_PUBLIC_SITE_URL = 'https://bri.fyi';

export function normalizeSiteUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return normalizeSiteUrl(configured);
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  return DEFAULT_PUBLIC_SITE_URL;
}

export function getInstallCommand(siteUrl = getSiteUrl()): string {
  return `curl -fsSL ${normalizeSiteUrl(siteUrl)}/install.sh | bash`;
}
