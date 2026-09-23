function cleanInline(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^\n)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^\n)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

export function noteDescription(text: string, maxLength = 165, title?: string): string {
  const normalizedTitle = title ? cleanInline(title).toLocaleLowerCase() : null;
  const candidates: string[] = [];
  let inCodeBlock = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock || !line || isTableSeparator(line) || line.includes('|')) continue;

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    const candidate = cleanInline(heading?.[1] ?? line);
    if (!candidate || candidate.toLocaleLowerCase() === normalizedTitle) continue;
    candidates.push(candidate);
    if (candidates.length === 2) break;
  }

  const cleaned = cleanInline(candidates.join(' · ') || text.replace(/```[\s\S]*?```/g, ' '));

  if (cleaned.length <= maxLength) return cleaned;
  const trimmed = cleaned.slice(0, maxLength);
  const lastSpace = trimmed.lastIndexOf(' ');
  return `${trimmed.slice(0, lastSpace > 0 ? lastSpace : maxLength)}...`;
}
