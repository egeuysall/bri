'use client';

import { useState } from 'react';
import { browsePublicFiles, type PublicIbxFile } from '@/lib/public-ibx-files';
import { PublicImageViewer } from '@/components/public-image-viewer';

export function PublicIbxFiles({ files }: { files: PublicIbxFile[] }) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const { path, folders, files: visibleFiles } = browsePublicFiles(files, currentPath);

  return <section className="space-y-3">
    <h2 className="text-xs text-neutral-500">Published files</h2>
    <nav aria-label="Folder location" className="flex flex-wrap items-center gap-1 text-sm">
      <button type="button" className="hover:underline" onClick={() => setCurrentPath([])}>drive</button>
      {path.map((segment, index) => <span key={index} className="flex items-center gap-1">
        <span aria-hidden="true" className="text-neutral-500">/</span>
        <button type="button" className="hover:underline" onClick={() => setCurrentPath(path.slice(0, index + 1))}>{segment}</button>
      </span>)}
    </nav>
    <div className="divide-y divide-neutral-800 border-y border-neutral-800">
      {folders.map((folder) => <button key={folder} type="button" className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors hover:bg-neutral-900/85" onClick={() => setCurrentPath([...path, folder])}>
        <span aria-hidden="true" className="w-4 shrink-0 text-center font-mono">/</span><span>{folder}</span>
      </button>)}
      {visibleFiles.map((file) => file.contentType.startsWith('image/')
        ? <PublicImageViewer key={file.url} fileName={file.fileName} href={file.url} className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors hover:bg-neutral-900/85" />
        : <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-3 text-sm no-underline transition-colors hover:bg-neutral-900/85">
          <span aria-hidden="true" className="w-4 shrink-0 text-center font-mono">-</span><span className="truncate">{file.fileName}</span>
        </a>)}
    </div>
  </section>;
}
