import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type Permission = "read" | "write" | "read_write";
type NeededPermission = "read" | "write";

function sanitizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function extractTitle(content: string): string {
  const heading = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^#\s+/.test(line));

  if (!heading) {
    return "Untitled";
  }

  return heading.replace(/^#\s+/, "").trim() || "Untitled";
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[`"'.,!?()[\]{}]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "note";
}

function hasPermission(permission: Permission, needed: NeededPermission): boolean {
  if (permission === "read_write") return true;
  return permission === needed;
}

function parseApiKey(rawApiKey: string): { prefix: string } | null {
  const normalized = rawApiKey.trim();
  const separatorIndex = normalized.indexOf(".");

  if (separatorIndex <= 0) return null;

  const prefix = normalized.slice(0, separatorIndex);
  if (!prefix.startsWith("bri_")) return null;

  return { prefix };
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const digestBytes = new Uint8Array(digest);
  return Array.from(digestBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function resolveApiKey(ctx: any, rawApiKey: string) {
  const parsed = parseApiKey(rawApiKey);
  if (!parsed) return null;

  const keyRecord = await ctx.db
    .query("apiKeys")
    .withIndex("by_prefix", (q: any) => q.eq("prefix", parsed.prefix))
    .unique();

  if (!keyRecord || keyRecord.revokedAt !== null) return null;

  const computedHash = await sha256Hex(rawApiKey);
  if (computedHash !== keyRecord.keyHash) return null;

  return keyRecord as Doc<"apiKeys">;
}

async function resolveUniqueSlug(
  ctx: any,
  ownerTokenIdentifier: string,
  baseSlug: string,
  skipNoteId?: Id<"notes">
): Promise<string> {
  let candidate = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await ctx.db
      .query("notes")
      .withIndex("by_ownerTokenIdentifier_and_slug", (q: any) =>
        q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("slug", candidate)
      )
      .unique();

    if (!existing || (skipNoteId && existing._id === skipNoteId)) {
      return candidate;
    }

    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

function mapNote(note: Doc<"notes">) {
  return {
    id: note._id,
    username: note.username,
    slug: note.slug,
    title: note.title,
    content: note.content,
    visibility: note.visibility,
    state: note.state,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    expiresAt: note.expiresAt,
    deletedAt: note.deletedAt,
    purgeAt: note.purgeAt,
  };
}

async function markDeleted(ctx: any, note: Doc<"notes">, now: number) {
  const purgeAt = now + THIRTY_DAYS_MS;
  await ctx.db.patch(note._id, {
    state: "deleted",
    deletedAt: now,
    purgeAt,
    updatedAt: now,
  });
  await ctx.scheduler.runAt(purgeAt, internal.notes.purgeDeletedNote, {
    noteId: note._id,
    expectedPurgeAt: purgeAt,
  });
}

export const listMine = query({
  args: {
    state: v.union(v.literal("active"), v.literal("deleted")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const ownerTokenIdentifier = identity.tokenIdentifier;
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_ownerTokenIdentifier_and_state_and_createdAt", (q) =>
        q.eq("ownerTokenIdentifier", ownerTokenIdentifier).eq("state", args.state)
      )
      .order("desc")
      .take(200);

    return notes.map(mapNote);
  },
});

export const getMineById = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.noteId);
    if (!note) return null;
    if (note.ownerTokenIdentifier !== identity.tokenIdentifier) return null;

    return mapNote(note);
  },
});

export const getByUsernameAndSlug = query({
  args: {
    username: v.string(),
    slug: v.string(),
    apiKey: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const username = sanitizeUsername(args.username);
    const slug = slugify(args.slug);

    if (!username || !slug) return null;

    const note = await ctx.db
      .query("notes")
      .withIndex("by_username_and_slug", (q) => q.eq("username", username).eq("slug", slug))
      .unique();

    if (!note || note.state !== "active") return null;

    if (note.visibility === "public") return mapNote(note);

    if (!args.apiKey) return null;
    const keyRecord = await resolveApiKey(ctx, args.apiKey);
    if (!keyRecord) return null;
    if (!hasPermission(keyRecord.permissions, "read")) return null;
    if (keyRecord.ownerTokenIdentifier !== note.ownerTokenIdentifier) return null;

    return mapNote(note);
  },
});

export const create = mutation({
  args: {
    username: v.string(),
    content: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
    expiresInDays: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const ownerTokenIdentifier = identity.tokenIdentifier;
    const username = sanitizeUsername(args.username);
    const content = args.content.trim();

    if (!username) throw new Error("Username is required");
    if (!content) throw new Error("Content cannot be empty");

    const title = extractTitle(content);
    const baseSlug = slugify(title);
    const uniqueSlug = await resolveUniqueSlug(ctx, ownerTokenIdentifier, baseSlug);
    const now = Date.now();

    const expiresInDays = args.expiresInDays ?? null;
    const expiresAt =
      typeof expiresInDays === "number" && expiresInDays > 0
        ? now + Math.floor(expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    const noteId = await ctx.db.insert("notes", {
      ownerTokenIdentifier,
      username,
      title,
      slug: uniqueSlug,
      content,
      visibility: args.visibility,
      state: "active",
      createdAt: now,
      updatedAt: now,
      expiresAt,
      deletedAt: null,
      purgeAt: null,
    });

    if (expiresAt !== null) {
      await ctx.scheduler.runAt(expiresAt, internal.notes.expireNote, {
        noteId,
        expectedExpiresAt: expiresAt,
      });
    }

    return {
      id: noteId,
      username,
      slug: uniqueSlug,
      title,
    };
  },
});

export const createWithApiKey = mutation({
  args: {
    apiKey: v.string(),
    content: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
    expiresInDays: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const keyRecord = await resolveApiKey(ctx, args.apiKey);
    if (!keyRecord) throw new Error("Invalid API key");
    if (!hasPermission(keyRecord.permissions, "write")) throw new Error("API key lacks write permission");

    const content = args.content.trim();
    if (!content) throw new Error("Content cannot be empty");

    const title = extractTitle(content);
    const baseSlug = slugify(title);
    const uniqueSlug = await resolveUniqueSlug(ctx, keyRecord.ownerTokenIdentifier, baseSlug);
    const now = Date.now();

    const expiresInDays = args.expiresInDays ?? null;
    const expiresAt =
      typeof expiresInDays === "number" && expiresInDays > 0
        ? now + Math.floor(expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    const noteId = await ctx.db.insert("notes", {
      ownerTokenIdentifier: keyRecord.ownerTokenIdentifier,
      username: keyRecord.username,
      title,
      slug: uniqueSlug,
      content,
      visibility: args.visibility,
      state: "active",
      createdAt: now,
      updatedAt: now,
      expiresAt,
      deletedAt: null,
      purgeAt: null,
    });

    await ctx.db.patch(keyRecord._id, { lastUsedAt: now });

    if (expiresAt !== null) {
      await ctx.scheduler.runAt(expiresAt, internal.notes.expireNote, {
        noteId,
        expectedExpiresAt: expiresAt,
      });
    }

    return {
      id: noteId,
      username: keyRecord.username,
      slug: uniqueSlug,
      title,
    };
  },
});

export const update = mutation({
  args: {
    noteId: v.id("notes"),
    content: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
    expiresInDays: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    if (note.ownerTokenIdentifier !== identity.tokenIdentifier) throw new Error("Forbidden");
    if (note.state !== "active") throw new Error("Cannot edit deleted note");

    const content = args.content.trim();
    if (!content) throw new Error("Content cannot be empty");

    const title = extractTitle(content);
    const baseSlug = slugify(title);
    const uniqueSlug = await resolveUniqueSlug(ctx, identity.tokenIdentifier, baseSlug, note._id);
    const now = Date.now();
    const expiresInDays = args.expiresInDays ?? null;
    const expiresAt =
      typeof expiresInDays === "number" && expiresInDays > 0
        ? now + Math.floor(expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    await ctx.db.patch(note._id, {
      title,
      slug: uniqueSlug,
      content,
      visibility: args.visibility,
      expiresAt,
      updatedAt: now,
    });

    if (expiresAt !== null) {
      await ctx.scheduler.runAt(expiresAt, internal.notes.expireNote, {
        noteId: note._id,
        expectedExpiresAt: expiresAt,
      });
    }

    return { id: note._id, slug: uniqueSlug, title };
  },
});

export const softDelete = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    if (note.ownerTokenIdentifier !== identity.tokenIdentifier) throw new Error("Forbidden");
    if (note.state === "deleted") return { deleted: true };

    await markDeleted(ctx, note, Date.now());
    return { deleted: true };
  },
});

export const restore = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    if (note.ownerTokenIdentifier !== identity.tokenIdentifier) throw new Error("Forbidden");
    if (note.state === "active") return { restored: true };

    await ctx.db.patch(note._id, {
      state: "active",
      deletedAt: null,
      purgeAt: null,
      updatedAt: Date.now(),
    });

    return { restored: true };
  },
});

export const permanentlyDelete = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.noteId);
    if (!note) return { deleted: true };
    if (note.ownerTokenIdentifier !== identity.tokenIdentifier) throw new Error("Forbidden");

    await ctx.db.delete(note._id);
    return { deleted: true };
  },
});

export const expireNote = internalMutation({
  args: {
    noteId: v.id("notes"),
    expectedExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) return;
    if (note.state !== "active") return;
    if (note.expiresAt !== args.expectedExpiresAt) return;

    await markDeleted(ctx, note, Date.now());
  },
});

export const purgeDeletedNote = internalMutation({
  args: {
    noteId: v.id("notes"),
    expectedPurgeAt: v.number(),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) return;
    if (note.state !== "deleted") return;
    if (note.purgeAt !== args.expectedPurgeAt) return;
    if (Date.now() < args.expectedPurgeAt) return;

    await ctx.db.delete(note._id);
  },
});
