'use client';

import { useState } from 'react';
import { toast } from 'sonner';

type ExportPdfButtonProps = {
  title: string;
};

type PdfTheme = {
  background: string;
  foreground: string;
  muted: string;
  line: string;
  accent: string;
  inlineCodeBackground: string;
  inlineCodeBorder: string;
  codeBackground: string;
  codeBorder: string;
};

function printableTitle(title: string) {
  return title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'bri note';
}

function themeColor(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function getPdfTheme(): PdfTheme {
  return {
    background: themeColor('--bg', '#050505'),
    foreground: themeColor('--fg', '#f5f5f5'),
    muted: themeColor('--muted', '#a3a3a3'),
    line: themeColor('--line', '#262626'),
    accent: themeColor('--accent', '#f4f4f5'),
    inlineCodeBackground: themeColor('--inline-code-bg', '#171717'),
    inlineCodeBorder: themeColor('--inline-code-border', '#2f2f35'),
    codeBackground: themeColor('--code-block-bg', '#171717'),
    codeBorder: themeColor('--code-block-border', '#34343a'),
  };
}

function pdfStyles(theme: PdfTheme) {
  return `
    @page {
      size: A4;
      margin: 0;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: ${theme.background};
      color: ${theme.foreground};
      font-family: Courier, "Courier New", monospace;
      font-size: 10.5pt;
      line-height: 1.55;
      height: 828pt;
    }

    .bri-pdf-note {
      width: 100%;
      min-height: 842pt;
      margin: 0;
      padding: 34pt 38pt 42pt;
      background: ${theme.background};
      color: ${theme.foreground};
      font-family: Courier, "Courier New", monospace;
    }

    .bri-pdf-article {
      width: 100%;
      max-width: none;
      margin: 0;
    }

    .bri-pdf-title {
      margin: 0;
      color: ${theme.foreground};
      font-size: 13.5pt;
      font-weight: 600;
      line-height: 1.35;
    }

    .bri-pdf-meta {
      margin: 6pt 0 0;
      color: ${theme.muted};
      font-size: 8.5pt;
      line-height: 1.4;
    }

    .bri-pdf-content {
      padding: 24pt 0 0;
    }

    .bri-pdf-note .prose {
      width: 100%;
      max-width: none;
      margin: 0;
      color: ${theme.muted};
      font-family: Courier, "Courier New", monospace;
      font-size: 10.5pt;
      line-height: 1.55;
    }

    .bri-pdf-note p {
      margin: 10pt 0;
    }

    .bri-pdf-note h1,
    .bri-pdf-note h2,
    .bri-pdf-note h3,
    .bri-pdf-note h4,
    .bri-pdf-note h5,
    .bri-pdf-note h6 {
      margin: 20pt 0 8pt;
      color: ${theme.foreground};
      font-weight: 600;
      line-height: 1.35;
      break-inside: avoid;
    }

    .bri-pdf-note h1 {
      font-size: 13.5pt;
    }

    .bri-pdf-note h2 {
      font-size: 12.5pt;
    }

    .bri-pdf-note h3,
    .bri-pdf-note h4,
    .bri-pdf-note h5,
    .bri-pdf-note h6 {
      font-size: 11pt;
    }

    .bri-pdf-note ul,
    .bri-pdf-note ol {
      margin: 10pt 0;
      padding-left: 20pt;
    }

    .bri-pdf-note li {
      margin: 3pt 0;
    }

    .bri-pdf-note blockquote {
      margin: 12pt 0;
      padding-left: 12pt;
      border-left: 2pt solid ${theme.line};
      color: ${theme.muted};
      break-inside: avoid;
    }

    .bri-pdf-note a {
      color: ${theme.accent};
      text-decoration: underline;
    }

    .bri-pdf-note hr {
      margin: 22pt 0;
      border: 0;
      border-top: 1pt solid ${theme.line};
    }

    .bri-pdf-note .prose code {
      color: ${theme.foreground};
      font-family: Courier, "Courier New", monospace;
      font-size: 0.9em;
    }

    .bri-pdf-note .prose > code,
    .bri-pdf-note .prose p > code,
    .bri-pdf-note .prose li > code {
      padding: 1pt 3pt;
      border: 1pt solid ${theme.inlineCodeBorder};
      background: ${theme.inlineCodeBackground};
    }

    .bri-pdf-note pre {
      margin: 10pt 0;
      break-inside: avoid;
    }

    .bri-pdf-note .code-block {
      margin: 10pt 0;
      break-inside: avoid;
    }

    .bri-pdf-note .code-block pre,
    .bri-pdf-note .shiki {
      margin: 0;
      padding: 9pt 10pt;
      border: 1pt solid ${theme.codeBorder};
      background: ${theme.codeBackground};
      color: ${theme.foreground};
      font-family: Courier, "Courier New", monospace;
      font-size: 8.5pt;
      line-height: 1.45;
    }

    .bri-pdf-note .code-block code {
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
    }

    .bri-pdf-note .shiki,
    .bri-pdf-note .shiki span {
      background: ${theme.codeBackground};
    }

    .bri-pdf-note table {
      width: 100%;
      max-width: 100%;
      margin: 10pt 0;
      border-collapse: collapse;
      break-inside: avoid;
    }

    .bri-pdf-note tr {
      break-inside: avoid;
    }

    .bri-pdf-note th,
    .bri-pdf-note td {
      padding: 6pt 10pt 6pt 0;
      border-bottom: 1pt solid ${theme.line};
      color: ${theme.muted};
      text-align: left;
      vertical-align: top;
    }

    .bri-pdf-note th {
      color: ${theme.foreground};
      font-weight: 600;
    }

    .bri-pdf-note figure {
      margin: 16pt 0;
      padding: 12pt;
      border: 1pt solid ${theme.line};
      background: ${theme.codeBackground};
      break-inside: avoid;
    }

    .bri-pdf-note figure > div {
      width: 100%;
    }

    .bri-pdf-note figure img {
      display: block;
      width: 100%;
      max-width: 100%;
      height: auto;
    }

    .bri-pdf-note .math-block {
      margin: 14pt 0;
      text-align: center;
      break-inside: avoid;
    }

    .bri-pdf-note .bri-pdf-math {
      color: ${theme.foreground};
      font-style: italic;
    }

    .bri-pdf-note .bri-pdf-checkbox {
      color: ${theme.foreground};
    }
  `;
}

async function waitForImages(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll('img')).map(
      (image) =>
        new Promise<void>((resolve) => {
          image.loading = 'eager';
          if (image.complete) {
            resolve();
            return;
          }

          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            window.clearTimeout(timeout);
            image.removeEventListener('load', finish);
            image.removeEventListener('error', finish);
            resolve();
          };
          const timeout = window.setTimeout(finish, 10_000);
          image.addEventListener('load', finish, { once: true });
          image.addEventListener('error', finish, { once: true });
        })
    )
  );
}

async function waitForCodeBlocks(root: HTMLElement) {
  const timeoutAt = Date.now() + 5_000;
  while (root.querySelector('[data-code-block-status="loading"]') && Date.now() < timeoutAt) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read image data'));
      }
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Unable to read image data')));
    reader.readAsDataURL(blob);
  });
}

async function inlineImages(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll<HTMLImageElement>('img')).map(async (image) => {
      const source = image.currentSrc || image.getAttribute('src') || '';
      if (!source || source.startsWith('data:')) return;

      try {
        const response = await fetch(source, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`Image request failed with ${response.status}`);
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('Image response has an invalid type');
        image.src = await blobToDataUrl(blob);
      } catch {
        const fallback = document.createElement('span');
        fallback.className = 'bri-pdf-image-fallback';
        fallback.textContent = `[Image: ${image.alt || 'unavailable'}]`;
        image.replaceWith(fallback);
      }
    })
  );
}

function replaceUnsupportedContent(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.katex').forEach((math) => {
    const annotation = math.querySelector('annotation');
    const value = annotation?.textContent?.trim() || math.textContent?.trim() || '';
    const fallback = document.createElement('span');
    fallback.className = 'bri-pdf-math';
    fallback.textContent = value;
    math.replaceWith(fallback);
  });

  const checkboxes = new Set<HTMLElement>([
    ...root.querySelectorAll<HTMLElement>('button[role="checkbox"]'),
    ...root.querySelectorAll<HTMLElement>('[data-slot="checkbox"]'),
    ...root.querySelectorAll<HTMLElement>('input[type="checkbox"]'),
  ]);

  checkboxes.forEach((checkbox) => {
    const isChecked =
      checkbox.getAttribute('aria-checked') === 'true' ||
      checkbox.hasAttribute('checked') ||
      checkbox.hasAttribute('data-checked');
    const fallback = document.createElement('span');
    fallback.className = 'bri-pdf-checkbox';
    fallback.textContent = isChecked ? '☑' : '☐';
    checkbox.replaceWith(fallback);
  });
}

function removeCustomPropertyStyles(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    if (element.getAttribute('style')?.includes('--')) {
      element.removeAttribute('style');
    }
  });
}

function normalizeCodeStyles(source: HTMLElement, exportDocument: HTMLElement) {
  const sourceTokens = Array.from(source.querySelectorAll<HTMLElement>('.shiki, .shiki span'));
  const exportTokens = Array.from(exportDocument.querySelectorAll<HTMLElement>('.shiki, .shiki span'));

  sourceTokens.forEach((sourceToken, index) => {
    const exportToken = exportTokens[index];
    if (!exportToken) return;

    const styles = getComputedStyle(sourceToken);
    exportToken.removeAttribute('style');
    exportToken.style.color = styles.color;
    exportToken.style.backgroundColor = styles.backgroundColor;
  });
}

function prepareExportDocument(source: HTMLElement) {
  const exportDocument = source.cloneNode(true) as HTMLElement;
  exportDocument.classList.add('bri-pdf-note');
  exportDocument.querySelector('article')?.classList.add('bri-pdf-article');
  exportDocument.querySelector('[data-note-export-title]')?.classList.add('bri-pdf-title');
  exportDocument.querySelector('[data-note-export-meta]')?.classList.add('bri-pdf-meta');
  exportDocument.querySelector('[data-note-export-content]')?.classList.add('bri-pdf-content');
  exportDocument.querySelector('[data-note-export-actions]')?.remove();
  removeCustomPropertyStyles(exportDocument);
  replaceUnsupportedContent(exportDocument);
  return exportDocument;
}

function downloadPdf(bytes: Uint8Array, filename: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function ExportPdfButton({ title }: ExportPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = async () => {
    if (isExporting) return;

    const source = document.querySelector<HTMLElement>('[data-note-export-root]');
    if (!source) {
      toast.error('Unable to export this note');
      return;
    }

    setIsExporting(true);

    try {
      await Promise.all([document.fonts.ready, waitForCodeBlocks(source), waitForImages(source)]);
      const exportDocument = prepareExportDocument(source);
      normalizeCodeStyles(source, exportDocument);
      await inlineImages(exportDocument);

      const { renderHtml } = await import('@formepdf/html/browser');
      const result = renderHtml(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>${exportDocument.outerHTML}</body></html>`,
        {
          css: pdfStyles(getPdfTheme()),
          lang: 'en',
          pageSize: 'A4',
        }
      );

      if (result.warnings.length > 0) {
        console.warn('[bri] PDF export warnings', result.warnings);
      }

      downloadPdf(result.pdf, `${printableTitle(title)}.pdf`);
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      className="shrink-0 rounded-sm border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-100 transition-colors hover:bg-neutral-900 disabled:cursor-wait disabled:opacity-60"
      disabled={isExporting}
      onClick={() => void exportPdf()}
    >
      {isExporting ? 'exporting...' : 'export pdf'}
    </button>
  );
}
