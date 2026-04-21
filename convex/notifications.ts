import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Permission = "read" | "write" | "read_write";
type NeededPermission = "read" | "write";
type ConvexCtx = QueryCtx | MutationCtx;

function sanitizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function readIdentityString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function usernameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const [localPart] = email.split("@");
  if (!localPart) return null;
  const cleaned = sanitizeUsername(localPart);
  return cleaned.length > 0 ? cleaned : null;
}

function resolveUsernameFromIdentity(identity: Record<string, unknown>): string | null {
  const raw =
    readIdentityString(identity.username) ??
    readIdentityString(identity.preferred_username) ??
    readIdentityString(identity.nickname) ??
    usernameFromEmail(readIdentityString(identity.email));
  if (!raw) return null;
  const cleaned = sanitizeUsername(raw);
  return cleaned.length > 0 ? cleaned : null;
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

async function resolveApiKey(ctx: ConvexCtx, rawApiKey: string) {
  const parsed = parseApiKey(rawApiKey);
  if (!parsed) return null;

  const keyRecord = await ctx.db
    .query("apiKeys")
    .withIndex("by_prefix", (q) => q.eq("prefix", parsed.prefix))
    .unique();
  if (!keyRecord || keyRecord.revokedAt !== null) return null;

  const computedHash = await sha256Hex(rawApiKey);
  if (computedHash !== keyRecord.keyHash) return null;

  return keyRecord as Doc<"apiKeys">;
}

async function resolveViewerUsername(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string,
  identity: Record<string, unknown>
) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_ownerTokenIdentifier", (q) => q.eq("ownerTokenIdentifier", tokenIdentifier))
    .unique();
  if (profile?.username) return profile.username;
  return resolveUsernameFromIdentity(identity);
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const username = await resolveViewerUsername(
      ctx,
      identity.tokenIdentifier,
      identity as unknown as Record<string, unknown>
    );
    if (!username) return { username: null, items: [] };

    const rows = await ctx.db
      .query("userNotifications")
      .withIndex("by_recipientUsername_and_dismissedAt_and_createdAt", (q) =>
        q.eq("recipientUsername", username).eq("dismissedAt", null)
      )
      .order("desc")
      .take(100);

    return {
      username,
      items: rows.map((row) => ({
        id: row._id,
        kind: row.kind,
        title: row.title,
        message: row.message,
        noteId: row.noteId,
        linkId: row.linkId,
        createdAt: row.createdAt,
      })),
    };
  },
});

export const dismiss = mutation({
  args: {
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const username = await resolveViewerUsername(
      ctx,
      identity.tokenIdentifier,
      identity as unknown as Record<string, unknown>
    );
    if (!username) throw new Error("Username is required");

    const row = await ctx.db.get(args.notificationId);
    if (!row) return { dismissed: true };
    if (row.recipientUsername !== username) throw new Error("Forbidden");
    if (row.dismissedAt !== null) return { dismissed: true };

    await ctx.db.patch(row._id, { dismissedAt: Date.now() });
    return { dismissed: true };
  },
});

export const resolveTarget = query({
  args: {
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const username = await resolveViewerUsername(
      ctx,
      identity.tokenIdentifier,
      identity as unknown as Record<string, unknown>
    );
    if (!username) throw new Error("Username is required");

    const row = await ctx.db.get(args.notificationId);
    if (!row) return { href: null as string | null };
    if (row.recipientUsername !== username) throw new Error("Forbidden");
    if (row.kind !== "invitation") return { href: null as string | null };

    if (row.noteId) {
      const note = await ctx.db.get(row.noteId);
      if (!note || note.state !== "active") return { href: null as string | null };

      if (note.visibility === "public" || note.username === username) {
        return { href: `/${note.username}/${note.slug}` };
      }

      const invite = await ctx.db
        .query("noteInvites")
        .withIndex("by_noteId_and_inviteeUsername", (q) =>
          q.eq("noteId", note._id).eq("inviteeUsername", username)
        )
        .unique();
      if (!invite) return { href: null as string | null };

      return { href: `/${note.username}/${note.slug}` };
    }

    if (row.linkId) {
      const link = await ctx.db.get(row.linkId);
      if (!link) return { href: null as string | null };

      if (link.username === username) {
        return { href: `/${link.username}/${link.key}` };
      }

      const invite = await ctx.db
        .query("quickLinkInvites")
        .withIndex("by_linkId_and_inviteeUsername", (q) =>
          q.eq("linkId", link._id).eq("inviteeUsername", username)
        )
        .unique();
      if (!invite) return { href: null as string | null };

      return { href: `/${link.username}/${link.key}` };
    }

    return { href: null as string | null };
  },
});

export const listByApiKey = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const keyRecord = await resolveApiKey(ctx, args.apiKey);
    if (!keyRecord) throw new Error("Invalid API key");
    if (!hasPermission(keyRecord.permissions, "read")) {
      throw new Error("API key lacks read permission");
    }

    const username = sanitizeUsername(keyRecord.username);
    if (!username) return { username: null, items: [] };

    const rows = await ctx.db
      .query("userNotifications")
      .withIndex("by_recipientUsername_and_dismissedAt_and_createdAt", (q) =>
        q.eq("recipientUsername", username).eq("dismissedAt", null)
      )
      .order("desc")
      .take(100);

    return {
      username,
      items: rows.map((row) => ({
        id: row._id,
        kind: row.kind,
        title: row.title,
        message: row.message,
        noteId: row.noteId,
        linkId: row.linkId,
        createdAt: row.createdAt,
      })),
    };
  },
});

export const dismissByApiKey = mutation({
  args: {
    apiKey: v.string(),
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, args) => {
    const keyRecord = await resolveApiKey(ctx, args.apiKey);
    if (!keyRecord) throw new Error("Invalid API key");
    if (!hasPermission(keyRecord.permissions, "write")) {
      throw new Error("API key lacks write permission");
    }

    const username = sanitizeUsername(keyRecord.username);
    if (!username) throw new Error("Username is required");

    const row = await ctx.db.get(args.notificationId);
    if (!row) return { dismissed: true };
    if (row.recipientUsername !== username) throw new Error("Forbidden");
    if (row.dismissedAt !== null) return { dismissed: true };

    const now = Date.now();
    await ctx.db.patch(row._id, { dismissedAt: now });
    await ctx.db.patch(keyRecord._id, { lastUsedAt: now });
    return { dismissed: true };
  },
});

export const resolveTargetByApiKey = query({
  args: {
    apiKey: v.string(),
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, args) => {
    const keyRecord = await resolveApiKey(ctx, args.apiKey);
    if (!keyRecord) throw new Error("Invalid API key");
    if (!hasPermission(keyRecord.permissions, "read")) {
      throw new Error("API key lacks read permission");
    }

    const username = sanitizeUsername(keyRecord.username);
    if (!username) throw new Error("Username is required");

    const row = await ctx.db.get(args.notificationId);
    if (!row) return { href: null as string | null };
    if (row.recipientUsername !== username) throw new Error("Forbidden");
    if (row.kind !== "invitation") return { href: null as string | null };

    if (row.noteId) {
      const note = await ctx.db.get(row.noteId);
      if (!note || note.state !== "active") return { href: null as string | null };

      if (note.visibility === "public" || note.username === username) {
        return { href: `/${note.username}/${note.slug}` };
      }

      const invite = await ctx.db
        .query("noteInvites")
        .withIndex("by_noteId_and_inviteeUsername", (q) =>
          q.eq("noteId", note._id).eq("inviteeUsername", username)
        )
        .unique();
      if (!invite) return { href: null as string | null };

      return { href: `/${note.username}/${note.slug}` };
    }

    if (row.linkId) {
      const link = await ctx.db.get(row.linkId);
      if (!link) return { href: null as string | null };

      if (link.username === username) {
        return { href: `/${link.username}/${link.key}` };
      }

      const invite = await ctx.db
        .query("quickLinkInvites")
        .withIndex("by_linkId_and_inviteeUsername", (q) =>
          q.eq("linkId", link._id).eq("inviteeUsername", username)
        )
        .unique();
      if (!invite) return { href: null as string | null };

      return { href: `/${link.username}/${link.key}` };
    }

    return { href: null as string | null };
  },
});
