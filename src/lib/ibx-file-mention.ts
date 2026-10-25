export function parseIBXFileMention(textBeforeCursor: string) {
  const match = /(?:^|\s)@([^\s@]*)$/.exec(textBeforeCursor);
  if (!match) return null;
  return { query: match[1] ?? '', markerOffset: match.index + match[0].lastIndexOf('@') };
}
