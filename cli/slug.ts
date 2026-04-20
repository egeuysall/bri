import { createHash } from 'node:crypto';
import path from 'node:path';

export function generateSlug(filename: string, content: string): string {
  const base = path.basename(filename);
  const ext = path.extname(base);
  let name = base.slice(0, base.length - ext.length);

  name = name.toLowerCase();
  name = name.replaceAll('_', '-').replaceAll(' ', '-');
  name = name.replace(/[^a-z0-9-]/g, '');

  const words = name.split('-').filter(Boolean);
  const shortWords = words.slice(0, 3);
  name = shortWords.join('-').slice(0, 20).replace(/-+$/g, '');

  const hash = createHash('sha256').update(content).digest();
  const shortHash = Buffer.from(hash.subarray(0, 4)).toString('base64url');

  if (!name) {
    return shortHash;
  }

  return `${name}--${shortHash}`;
}
