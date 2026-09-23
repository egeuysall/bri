import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getNoteByUsernameAndSlug } from '@/lib/notes';
import { noteDescription } from '@/lib/note-seo';
import { isPublicResourcePath, isPublicUsernamePath } from '@/lib/user-handle';

export const alt = 'bri note preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

const geistMonoFont = readFile(path.join(process.cwd(), 'public/fonts/geist-mono-latin.ttf'));

function geometricMark(seed: string): string {
  const hash = createHash('sha256').update(seed).digest();
  const shapes = [
    '<polygon points="210,34 384,374 36,374" />',
    '<rect x="54" y="54" width="312" height="312" />',
    '<polygon points="210,28 392,210 210,392 28,210" />',
    '<circle cx="210" cy="210" r="174" />',
  ];
  const byte = (index: number) => hash[index] ?? 0;
  const shape = shapes[byte(3) % shapes.length] ?? '';
  const rotation = byte(1) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">
    <g transform="rotate(${rotation} 210 210)">
      <g fill="#ffffff">${shape}</g>
    </g>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

type ImageProps = {
  params: Promise<{ username: string; slug: string }>;
};

function wrapText(value: string, maxCharacters: number, maxLines: number): string[] {
  const words = value.split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let truncated = false;

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxCharacters) {
      line = next;
      continue;
    }

    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) {
      truncated = true;
      break;
    }
  }

  if (lines.length < maxLines && line) lines.push(line);
  if (truncated && lines.length) {
    const last = lines[lines.length - 1] ?? '';
    lines[lines.length - 1] = `${last.replace(/\s+\S*$/, '')}...`;
  }

  return lines;
}

export default async function Image({ params }: ImageProps) {
  const { username, slug } = await params;
  const isValidPath = isPublicUsernamePath(username) && isPublicResourcePath(slug);
  const note = isValidPath
    ? await getNoteByUsernameAndSlug({ username, slug }).catch(() => null)
    : null;
  const title = note?.title ?? 'bri note';
  const description = note
    ? noteDescription(note.content, 220, note.title)
    : 'publish anything.';
  const titleLines = wrapText(title, 28, 2);
  const descriptionLines = wrapText(description, 36, 3);
  const notePath = note ? `${note.username}/${note.slug}` : 'share your markdown';
  const createdDate = note ? new Date(note.createdAt).toISOString().slice(0, 10) : '';
  const geometricShape = geometricMark(notePath);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: '52px 64px 46px',
          background: '#050505',
          color: '#f5f5f5',
          fontFamily: 'Geist Mono',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 28,
              fontWeight: 500,
              color: '#737373',
            }}
          >
            <span>bri.fyi</span>
            <span>{createdDate}</span>
          </div>

          <div
            style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              gap: 48,
            }}
          >
            <div
              style={{
                width: '58%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  fontSize: 80,
                  lineHeight: 1.02,
                  fontWeight: 500,
                  letterSpacing: -3,
                }}
              >
                {titleLines.map((line, index) => (
                  <div key={`${line}-${index}`}>{line}</div>
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  marginTop: 26,
                  fontSize: 30,
                  lineHeight: 1.35,
                  color: '#a3a3a3',
                }}
              >
                {descriptionLines.map((line, index) => (
                  <div key={`${line}-${index}`}>{line}</div>
                ))}
              </div>
            </div>
            <div
              style={{
                width: '34%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img src={geometricShape} width={340} height={340} />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 18,
              fontSize: 26,
              fontWeight: 500,
              color: '#737373',
            }}
          >
            <span>{notePath}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Geist Mono',
          data: await geistMonoFont,
          weight: 400,
          style: 'normal',
        },
      ],
    }
  );
}
