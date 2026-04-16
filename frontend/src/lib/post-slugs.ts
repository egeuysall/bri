const MARKDOWN_ALIAS_EXTENSION = '.md';

export function isMarkdownAlias(identifier: string): boolean {
  return identifier.toLowerCase().endsWith(MARKDOWN_ALIAS_EXTENSION);
}

export function stripMarkdownAlias(identifier: string): string {
  return isMarkdownAlias(identifier)
    ? identifier.slice(0, -MARKDOWN_ALIAS_EXTENSION.length)
    : identifier;
}

export function getMarkdownAlias(slug: string): string {
  return `${stripMarkdownAlias(slug)}${MARKDOWN_ALIAS_EXTENSION}`;
}
