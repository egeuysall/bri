'use client';

import { useState } from 'react';
import { toast } from 'sonner';

type ExportPdfButtonProps = {
  title: string;
};

function printableTitle(title: string) {
  return title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'bri note';
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
    let stage: HTMLDivElement | null = null;

    try {
      const html2pdfPromise = import('html2pdf.js');
      await Promise.all([document.fonts.ready, waitForCodeBlocks(source)]);

      stage = document.createElement('div');
      const exportDocument = source.cloneNode(true) as HTMLElement;
      stage.className = 'pdf-export-stage';
      exportDocument.classList.add('pdf-export-document');
      exportDocument.querySelector('[data-note-export-actions]')?.remove();
      stage.append(exportDocument);
      document.body.append(stage);

      const [{ default: html2pdf }] = await Promise.all([
        html2pdfPromise,
        waitForImages(exportDocument),
      ]);
      const options = {
        margin: [16, 16, 18, 16] as [number, number, number, number],
        filename: `${printableTitle(title)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        enableLinks: true,
        pagebreak: { mode: ['css', 'legacy'] },
        html2canvas: {
          backgroundColor: '#ffffff',
          imageTimeout: 15_000,
          logging: false,
          scale: 2,
          useCORS: true,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait' as const,
        },
      };

      await html2pdf().set(options).from(exportDocument).save();
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      stage?.remove();
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
