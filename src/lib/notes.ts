import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '../../convex/_generated/api';

export type NoteVisibility = 'public' | 'private';
export type NoteState = 'active' | 'deleted';

export type NoteRecord = {
  id: string;
  username: string;
  slug: string;
  title: string;
  content: string;
  visibility: NoteVisibility;
  state: NoteState;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  deletedAt: number | null;
  purgeAt: number | null;
};

export type ApiKeyRecord = {
  id: string;
  prefix: string;
  permissions: 'read' | 'write' | 'read_write';
  label: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
};

export async function getNoteByUsernameAndSlug(input: {
  username: string;
  slug: string;
  apiKey?: string | null;
}): Promise<NoteRecord | null> {
  const data = await fetchQuery(api.notes.getByUsernameAndSlug, {
    username: input.username,
    slug: input.slug,
    apiKey: input.apiKey ?? null,
  });
  return data ?? null;
}

export async function listMyNotes(input: {
  state: NoteState;
  token: string;
}): Promise<NoteRecord[]> {
  return await fetchQuery(
    api.notes.listMine,
    { state: input.state },
    { token: input.token }
  );
}

export async function createNoteWithAuth(input: {
  token: string;
  username: string;
  content: string;
  visibility: NoteVisibility;
  expiresInDays: number | null;
}) {
  return await fetchMutation(
    api.notes.create,
    {
      username: input.username,
      content: input.content,
      visibility: input.visibility,
      expiresInDays: input.expiresInDays,
    },
    { token: input.token }
  );
}

export async function createNoteWithApiKey(input: {
  apiKey: string;
  content: string;
  visibility: NoteVisibility;
  expiresInDays: number | null;
}) {
  return await fetchMutation(api.notes.createWithApiKey, {
    apiKey: input.apiKey,
    content: input.content,
    visibility: input.visibility,
    expiresInDays: input.expiresInDays,
  });
}

export async function updateNote(input: {
  token: string;
  noteId: string;
  content: string;
  visibility: NoteVisibility;
  expiresInDays: number | null;
}) {
  return await fetchMutation(
    api.notes.update,
    {
      noteId: input.noteId as any,
      content: input.content,
      visibility: input.visibility,
      expiresInDays: input.expiresInDays,
    },
    { token: input.token }
  );
}

export async function softDeleteNote(input: { token: string; noteId: string }) {
  return await fetchMutation(
    api.notes.softDelete,
    { noteId: input.noteId as any },
    { token: input.token }
  );
}

export async function restoreNote(input: { token: string; noteId: string }) {
  return await fetchMutation(
    api.notes.restore,
    { noteId: input.noteId as any },
    { token: input.token }
  );
}

export async function permanentlyDeleteNote(input: { token: string; noteId: string }) {
  return await fetchMutation(
    api.notes.permanentlyDelete,
    { noteId: input.noteId as any },
    { token: input.token }
  );
}

export async function listMyApiKeys(input: { token: string }): Promise<ApiKeyRecord[]> {
  return await fetchQuery(api.apiKeys.listMine, {}, { token: input.token });
}

export async function createApiKeyHashed(input: {
  token: string;
  username: string;
  prefix: string;
  keyHash: string;
  permissions: 'read' | 'write' | 'read_write';
  label: string | null;
}) {
  return await fetchMutation(
    api.apiKeys.createHashed,
    {
      username: input.username,
      prefix: input.prefix,
      keyHash: input.keyHash,
      permissions: input.permissions,
      label: input.label,
    },
    { token: input.token }
  );
}

export async function revokeApiKey(input: { token: string; keyId: string }) {
  return await fetchMutation(
    api.apiKeys.revokeMine,
    { keyId: input.keyId as any },
    { token: input.token }
  );
}
