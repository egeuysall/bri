'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function PublicImageViewer({ fileName, href, className }: { fileName: string; href: string; className: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-label={`View ${fileName}`} onClick={() => setOpen(true)} className={className}>
      <span aria-hidden="true" className="w-4 shrink-0 text-center font-mono">-</span><span className="truncate">{fileName}</span>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[min(56rem,calc(100%-2rem))] gap-3 border-neutral-800 bg-neutral-950 text-neutral-100 sm:max-w-4xl">
        <DialogHeader className="pe-8"><DialogTitle className="truncate text-sm">{fileName}</DialogTitle></DialogHeader>
        <div className="flex max-h-[75vh] items-center justify-center overflow-hidden rounded-sm border border-neutral-800 bg-black">
          <Image src={href} alt={fileName} width={2400} height={1600} unoptimized className="max-h-[70vh] w-auto max-w-full object-contain" />
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
