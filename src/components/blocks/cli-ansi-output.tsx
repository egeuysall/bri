import type { CSSProperties } from 'react';

const colors = Array.from({ length: 8 }, (_, index) => `var(--terminal-ansi-${index})`);
const brightColors = Array.from({ length: 8 }, (_, index) => `var(--terminal-ansi-${index + 8})`);
const sgr = /\x1b\[([\d;]*)m/g;
const escapes = /\x1b\[[0-?]*[ -/]*[@-~]/g;

function indexedColor(index: number) {
  index = Math.max(0, Math.min(255, index));
  if (index < 16) return [...colors, ...brightColors][index] ?? 'var(--foreground)';
  if (index >= 232) {
    const level = 8 + (index - 232) * 10;
    return `color-mix(in srgb, var(--foreground) ${Math.round((level / 255) * 72 + 18)}%, var(--muted-foreground))`;
  }
  const value = index - 16;
  const levels = [0, 95, 135, 175, 215, 255];
  const rgb = `rgb(${levels[Math.floor(value / 36)]} ${levels[Math.floor((value % 36) / 6)]} ${levels[value % 6]})`;
  return `color-mix(in srgb, ${rgb} 62%, var(--foreground))`;
}

function parseLine(line: string) {
  const parts: Array<{ text: string; style: CSSProperties }> = [];
  let style: CSSProperties = {};
  let cursor = 0;
  let match: RegExpExecArray | null;
  sgr.lastIndex = 0;
  while ((match = sgr.exec(line))) {
    if (match.index > cursor) parts.push({ text: line.slice(cursor, match.index).replace(escapes, ''), style });
    const codes = (match[1] || '0').split(';').map((raw) => Number(raw || 0));
    for (let index = 0; index < codes.length; index += 1) {
      const code = codes[index] ?? 0;
      if (code === 0) style = {};
      else if (code === 1) style = { ...style, fontWeight: 600 };
      else if (code === 3) style = { ...style, fontStyle: 'italic' };
      else if (code === 4) style = { ...style, textDecoration: 'underline' };
      else if (code === 22) style = { ...style, fontWeight: undefined };
      else if (code === 23) style = { ...style, fontStyle: undefined };
      else if (code === 24) style = { ...style, textDecoration: undefined };
      else if (code === 39) style = { ...style, color: undefined };
      else if (code === 49) style = { ...style, backgroundColor: undefined };
      else if (code >= 30 && code <= 37) style = { ...style, color: colors[code - 30] };
      else if (code >= 90 && code <= 97) style = { ...style, color: brightColors[code - 90] };
      else if (code >= 40 && code <= 47) style = { ...style, backgroundColor: colors[code - 40] };
      else if (code >= 100 && code <= 107) style = { ...style, backgroundColor: brightColors[code - 100] };
      else if (code === 38 || code === 48) {
        const target = code === 38 ? 'color' : 'backgroundColor';
        const indexed = codes[index + 2];
        const red = codes[index + 2];
        const green = codes[index + 3];
        const blue = codes[index + 4];
        if (codes[index + 1] === 5 && indexed !== undefined) {
          style = { ...style, [target]: indexedColor(indexed) };
          index += 2;
        } else if (codes[index + 1] === 2 && red !== undefined && green !== undefined && blue !== undefined) {
          style = { ...style, [target]: `rgb(${[red, green, blue].map((channel) => Math.max(0, Math.min(255, channel))).join(' ')})` };
          index += 4;
        }
      }
    }
    cursor = sgr.lastIndex;
  }
  const remainder = line.slice(cursor).replace(escapes, '').replace(/\r/g, '');
  if (remainder) parts.push({ text: remainder, style });
  return parts;
}

export function CliAnsiOutput({ output }: { output: string }) {
  const lines = output.split('\n');
  return <span className="whitespace-pre-wrap">{lines.map((line, lineIndex) => (
    <span key={lineIndex}>{parseLine(line).map((part, index) => <span key={index} style={part.style}>{part.text}</span>)}{lineIndex < lines.length - 1 ? '\n' : null}</span>
  ))}</span>;
}
