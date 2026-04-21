'use client';

import { Facehash } from 'facehash';

export function PublicProfileAvatar({ name }: { name: string }) {
  return (
    <div className="rounded-sm border border-neutral-800 bg-neutral-900 p-0.5">
      <Facehash name={name} size={40} variant="solid" enableBlink intensity3d="subtle" />
    </div>
  );
}
