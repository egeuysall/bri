export function formatQuickLinkTitle(label: string | null | undefined, key: string): string {
  const rawValue = (label ?? '').trim() || key.trim();
  if (!rawValue) return 'Quick Link';

  return rawValue
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (char) => char.toUpperCase());
}
