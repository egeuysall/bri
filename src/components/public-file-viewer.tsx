'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function PublicFileViewer({ fileName, contentType, href, className }: { fileName: string; contentType: string; href: string; className: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-label={`View ${fileName}`} onClick={() => setOpen(true)} className={className}>
      <span aria-hidden="true" className="w-4 shrink-0 text-center font-mono">-</span><span className="truncate">{fileName}</span>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[min(56rem,calc(100%-2rem))] gap-3 border-neutral-800 bg-neutral-950 text-neutral-100 sm:max-w-4xl">
        <DialogHeader className="pe-8"><DialogTitle className="truncate text-sm">{fileName}</DialogTitle></DialogHeader>
        <div className="overflow-hidden rounded-sm border border-neutral-800 bg-black">
          {contentType.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={href} alt={fileName} className="max-h-[70vh] w-full object-contain" />
          ) : contentType.startsWith('video/') ? (
            <video src={href} controls playsInline preload="metadata" aria-label={fileName} className="max-h-[70vh] w-full" />
          ) : contentType.startsWith('audio/') ? (
            <audio src={href} controls preload="metadata" aria-label={fileName} className="w-full" />
          ) : contentType === 'application/pdf' ? (
            <iframe src={href} title={fileName} className="h-[70vh] w-full" />
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer" className="block p-4 underline">open file</a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
