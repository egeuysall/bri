import { browsePublicFiles } from '@/lib/public-drive';

export type PublicIbxFile = { fileName: string; folderPath: string[]; contentType: string; url: string };

export async function listPublicIbxFiles(username: string): Promise<PublicIbxFile[]> {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(username)) return [];
  const files: PublicIbxFile[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  try {
    while (true) {
      const url = new URL(`https://ibx.egeuysal.com/api/public/files/${encodeURIComponent(username)}`);
      if (cursor) url.searchParams.set('cursor', cursor);
      const response = await fetch(url, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) return [];
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || !('files' in body) || !Array.isArray(body.files)) return [];
      for (const item of body.files) {
        if (!item || typeof item !== 'object') continue;
        const file = item as { fileName?: unknown; folderPath?: unknown; contentType?: unknown; url?: unknown };
        if (typeof file.fileName !== 'string' || !Array.isArray(file.folderPath) || !file.folderPath.every((part) => typeof part === 'string') || typeof file.contentType !== 'string' || typeof file.url !== 'string') continue;
        try {
          if (new URL(file.url).origin !== 'https://ibx.egeuysal.com') continue;
        } catch { continue; }
        files.push({ fileName: file.fileName, folderPath: file.folderPath as string[], contentType: file.contentType, url: file.url });
      }
      if (!('cursor' in body) || typeof body.cursor !== 'string' || !body.cursor || seenCursors.has(body.cursor)) return files;
      seenCursors.add(body.cursor);
      cursor = body.cursor;
    }
  } catch {
    return files;
  }
}

export { browsePublicFiles };
