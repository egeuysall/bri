import { validateUrl } from './core/runtime';

export async function readPublicNote(input: {
  username: string;
  slug: string;
  siteUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<unknown> {
  const base = validateUrl(input.siteUrl, 'site-url');
  const endpoint = new URL(
    `/api/public/notes/${encodeURIComponent(input.username)}/${encodeURIComponent(input.slug)}`,
    base
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 5_000);

  try {
    const response = await fetch(endpoint, {
      headers: input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {},
      redirect: 'error',
      signal: controller.signal,
    });
    const raw = await response.text();
    if (raw.length > 1_000_000) throw new Error('Public note is too large to preview.');
    const parsed = raw ? (JSON.parse(raw) as { data?: unknown; error?: string }) : {};
    if (!response.ok) throw new Error(parsed.error || `request failed (${response.status})`);
    return parsed.data ?? {};
  } finally {
    clearTimeout(timer);
  }
}
