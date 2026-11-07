import { NextResponse } from 'next/server';
import { listPublicNotesByUsername, listPublicNoteFoldersByUsername } from '@/lib/notes';
import { isPublicUsernamePath, normalizePathHandle } from '@/lib/user-handle';

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (username.length > 64 || !isPublicUsernamePath(username)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const handle = normalizePathHandle(username);
    const [notes, folders] = await Promise.all([listPublicNotesByUsername({ username: handle }), listPublicNoteFoldersByUsername(handle)]);
    const byId = new Map(folders.map(folder => [folder.id, folder]));
    const folderPath = (folderId: string | null) => {
      const path: string[] = [];
      const visited = new Set<string>();
      for (let id = folderId; id && byId.has(id) && !visited.has(id); id = byId.get(id)?.parentFolderId ?? null) {
        visited.add(id);
        path.unshift(byId.get(id)!.name);
      }
      return path;
    };
    return NextResponse.json({ data: notes.map(({ username: noteUsername, slug, title, createdAt, updatedAt, folderId }) => ({ username: noteUsername, slug, title, createdAt, updatedAt, folderPath: folderPath(folderId) })) }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Could not load public notes.' }, { status: 503 });
  }
}
