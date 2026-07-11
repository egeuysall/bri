'use client';

type ExportPdfButtonProps = {
  title: string;
};

function printableTitle(title: string) {
  return title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'bri note';
}

export function ExportPdfButton({ title }: ExportPdfButtonProps) {
  const exportPdf = () => {
    const previousTitle = document.title;
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };

    document.title = printableTitle(title);
    window.addEventListener('afterprint', restoreTitle, { once: true });
    window.print();
    window.setTimeout(restoreTitle, 1_000);
  };

  return (
    <button
      type="button"
      className="shrink-0 rounded-sm border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-100 transition-colors hover:bg-neutral-900"
      onClick={exportPdf}
    >
      Export PDF
    </button>
  );
}
