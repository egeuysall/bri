'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function PublicFileViewer({ fileName, contentType, href, className }: { fileName: string; contentType: string; href: string; className: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <div className={`flex w-full items-center justify-between gap-2 ${className}`}>
      <button type="button" aria-label={`View ${fileName}`} onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
        <span aria-hidden="true" className="w-4 shrink-0 text-center font-mono">-</span><span className="truncate">{fileName}</span>
      </button>
      <Button type="button" variant="ghost" size="sm" aria-label={`Copy public link for ${fileName}`} onClick={async () => {
        try {
          await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
          toast.success('Public link copied.');
        } catch {
          toast.error('Could not copy link.');
        }
      }}>copy link</Button>
    </div>
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
