'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { browsePublicFiles, type PublicIbxFile } from '@/lib/public-ibx-files';
import { PublicFileViewer } from '@/components/public-file-viewer';

export function PublicIbxFiles({ files, startDelay }: { files: PublicIbxFile[]; startDelay: number }) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const { path, folders, files: visibleFiles } = browsePublicFiles(files, currentPath);

  return <section className="space-y-3">
    <h2 className="animate-enter text-xs text-neutral-500" style={{ '--delay': `${startDelay}ms` } as CSSProperties}>Published files</h2>
    <nav aria-label="Folder location" className="animate-enter flex flex-wrap items-center gap-1 text-sm" style={{ '--delay': `${startDelay + 55}ms` } as CSSProperties}>
      <button type="button" className="hover:underline" onClick={() => setCurrentPath([])}>drive</button>
      {path.map((segment, index) => <span key={index} className="flex items-center gap-1">
        <span aria-hidden="true" className="text-neutral-500">/</span>
        <button type="button" className="hover:underline" onClick={() => setCurrentPath(path.slice(0, index + 1))}>{segment}</button>
      </span>)}
    </nav>
    <div className="divide-y divide-neutral-800 border-y border-neutral-800">
      {folders.map((folder, index) => <button key={folder} type="button" className="animate-enter flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors hover:bg-neutral-900/85" style={{ '--delay': `${startDelay + 110 + index * 45}ms` } as CSSProperties} onClick={() => setCurrentPath([...path, folder])}>
        <span aria-hidden="true" className="w-4 shrink-0 text-center font-mono">/</span><span>{folder}</span>
      </button>)}
      {visibleFiles.map((file, index) => <PublicFileViewer key={file.url} fileName={file.fileName} contentType={file.contentType} href={file.url} className="animate-enter px-3 py-1.5 text-sm transition-colors hover:bg-neutral-900/85" style={{ '--delay': `${startDelay + 110 + (folders.length + index) * 45}ms` } as CSSProperties} />)}
    </div>
  </section>;
}
