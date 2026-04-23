import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
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

function cleanDisplayName(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, 120);
  return cleaned.length > 0 ? cleaned : null;
}

function cleanEmail(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase().slice(0, 200);
  if (!cleaned.includes("@")) return null;
  return cleaned;
}

function sanitizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function sanitizeLabel(value: string | null): string | null {
  if (value === null) return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, 120);
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeUrl(value: string): string {
  const raw = value.trim();
  if (!raw) throw new Error("Target URL is required");

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("Invalid target URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid target URL protocol");
  }

  return url.toString();
}

function sanitizePath(path: string): string {
  const cleaned = path.trim().replace(/\s+/g, " ");
  if (!cleaned.startsWith("/")) return "/";
  return cleaned.slice(0, 300);
}

function dayKeyFromEpoch(epochMs: number): string {
  const date = new Date(epochMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

async function upsertUserProfile(
  ctx: MutationCtx,
  identity: { tokenIdentifier: string } & Record<string, unknown>,
  username: string
) {
  const displayName = cleanDisplayName(readIdentityString(identity.name));
  const email = cleanEmail(readIdentityString(identity.email));
  const now = Date.now();

  const existing = await ctx.db
    .query("userProfiles")
    .withIndex("by_ownerTokenIdentifier", (q) =>
      q.eq("ownerTokenIdentifier", identity.tokenIdentifier)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      username,
      displayName,
      email,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("userProfiles", {
    ownerTokenIdentifier: identity.tokenIdentifier,
    username,
    displayName,
    email,
    createdAt: now,
    updatedAt: now,
  });
}

function mapLink(link: {
  _id: string;
  username: string;
  key: string;
  targetUrl: string;
  label: string | null;
  clicks: number;
  createdAt: number;
  updatedAt: number;
  lastClickedAt: number | null;
}) {
  return {
    id: link._id,
    username: link.username,
    key: link.key,
    targetUrl: link.targetUrl,
    label: link.label,
    clicks: link.clicks,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    lastClickedAt: link.lastClickedAt,
  };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const rows = await ctx.db
      .query("quickLinks")
      .withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
        q.eq("ownerTokenIdentifier", identity.tokenIdentifier)
      )
      .order("desc")
      .take(200);

    return rows.map(mapLink);
  },
});

export const listInviteSummaryMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const links = await ctx.db
      .query("quickLinks")
      .withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
        q.eq("ownerTokenIdentifier", identity.tokenIdentifier)
      )
      .order("desc")
      .take(200);

    const rows: Array<{ linkId: Id<"quickLinks">; invitedCount: number; invitees: string[] }> = [];
    for (const link of links) {
      const invites = await ctx.db
        .query("quickLinkInvites")
        .withIndex("by_linkId_and_inviteeUsername", (q) => q.eq("linkId", link._id))
        .take(200);
      const invitees = invites.map((invite) => invite.inviteeUsername);
      rows.push({
        linkId: link._id,
        invitedCount: invitees.length,
        invitees,
      });
    }
    return rows;
  },
});

export const listInviteSummaryByApiKey = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const keyRecord = await resolveApiKey(ctx, args.apiKey);
    if (!keyRecord) throw new Error("Invalid API key");
    if (!hasPermission(keyRecord.permissions, "read")) {
      throw new Error("API key lacks read permission");
    }

    const links = await ctx.db
      .query("quickLinks")
      .withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
        q.eq("ownerTokenIdentifier", keyRecord.ownerTokenIdentifier)
      )
      .order("desc")
      .take(200);

    const rows: Array<{ linkId: Id<"quickLinks">; invitedCount: number; invitees: string[] }> = [];
    for (const link of links) {
      const invites = await ctx.db
        .query("quickLinkInvites")
        .withIndex("by_linkId_and_inviteeUsername", (q) => q.eq("linkId", link._id))
        .take(200);
      const invitees = invites.map((invite) => invite.inviteeUsername);
      rows.push({
        linkId: link._id,
        invitedCount: invitees.length,
        invitees,
      });
    }
    return rows;
  },
});

export const listByUsername = query({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const username = sanitizeUsername(args.username);
    if (!username) return [];

    const rows = await ctx.db
      .query("quickLinks")
      .withIndex("by_username_and_key", (q) => q.eq("username", username))
      .order("desc")
      .take(200);

    return rows.map(mapLink);
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

    const rows = await ctx.db
      .query("quickLinks")
      .withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
        q.eq("ownerTokenIdentifier", keyRecord.ownerTokenIdentifier)
      )
      .order("desc")
      .take(200);

    return rows.map(mapLink);
  },
});

export const getByUsernameAndKey = query({
  args: {
    username: v.string(),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const username = sanitizeUsername(args.username);
    const key = sanitizeKey(args.key);
    if (!username || !key) return null;

    const link = await ctx.db
      .query("quickLinks")
      .withIndex("by_username_and_key", (q) => q.eq("username", username).eq("key", key))
      .unique();

    return link ? mapLink(link) : null;
  },
});

export const create = mutation({
  args: {
    username: v.string(),
    key: v.string(),
    targetUrl: v.string(),
    label: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const username = sanitizeUsername(args.username);
    const key = sanitizeKey(args.key);
    const targetUrl = normalizeUrl(args.targetUrl);
    const label = sanitizeLabel(args.label);

    if (!username) throw new Error("Username is required");
    if (!key) throw new Error("Quick link key is required");
    await upsertUserProfile(
      ctx,
      identity as { tokenIdentifier: string } & Record<string, unknown>,
      username
    );

    const existing = await ctx.db
      .query("quickLinks")
      .withIndex("by_ownerTokenIdentifier_and_key", (q) =>
        q.eq("ownerTokenIdentifier", identity.tokenIdentifier).eq("key", key)
      )
      .unique();

    if (existing) throw new Error("Quick link key already exists");

    const now = Date.now();
    const id = await ctx.db.insert("quickLinks", {
      ownerTokenIdentifier: identity.tokenIdentifier,
      username,
      key,
      targetUrl,
      label,
      clicks: 0,
      createdAt: now,
      updatedAt: now,
      lastClickedAt: null,
    });

    return { id, key };
  },
});

export const inviteUser = mutation({
  args: {
    linkId: v.id("quickLinks"),
    inviteeUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const link = await ctx.db.get(args.linkId);
    if (!link) throw new Error("Quick link not found");
    if (link.ownerTokenIdentifier !== identity.tokenIdentifier) throw new Error("Forbidden");

    const inviteeUsername = sanitizeUsername(args.inviteeUsername);
    if (!inviteeUsername) throw new Error("Invitee username is required");
    if (inviteeUsername === link.username) throw new Error("Cannot invite yourself");

    const existingInvite = await ctx.db
      .query("quickLinkInvites")
      .withIndex("by_linkId_and_inviteeUsername", (q) =>
        q.eq("linkId", link._id).eq("inviteeUsername", inviteeUsername)
      )
      .unique();
    if (existingInvite) return { invited: true, alreadyInvited: true };

    const now = Date.now();
    await ctx.db.insert("quickLinkInvites", {
      ownerTokenIdentifier: identity.tokenIdentifier,
      linkId: link._id,
      inviteeUsername,
      createdAt: now,
    });

    await ctx.db.insert("userNotifications", {
      recipientUsername: inviteeUsername,
      kind: "invitation",
      title: "Link invitation",
      message: `@${link.username} shared link /${link.username}/${link.key}`,
      noteId: null,
      linkId: link._id,
      createdAt: now,
      dismissedAt: null,
    });

    return { invited: true, alreadyInvited: false };
  },
});

export const inviteUserWithApiKey = mutation({
  args: {
    apiKey: v.string(),
    linkId: v.id("quickLinks"),
    inviteeUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const keyRecord = await resolveApiKey(ctx, args.apiKey);
    if (!keyRecord) throw new Error("Invalid API key");
    if (!hasPermission(keyRecord.permissions, "write")) {
      throw new Error("API key lacks write permission");
    }

    const link = await ctx.db.get(args.linkId);
    if (!link) throw new Error("Quick link not found");
    if (link.ownerTokenIdentifier !== keyRecord.ownerTokenIdentifier) throw new Error("Forbidden");

    const inviteeUsername = sanitizeUsername(args.inviteeUsername);
    if (!inviteeUsername) throw new Error("Invitee username is required");
    if (inviteeUsername === link.username) throw new Error("Cannot invite yourself");

    const existingInvite = await ctx.db
      .query("quickLinkInvites")
      .withIndex("by_linkId_and_inviteeUsername", (q) =>
        q.eq("linkId", link._id).eq("inviteeUsername", inviteeUsername)
      )
      .unique();
    if (existingInvite) return { invited: true, alreadyInvited: true };

    const now = Date.now();
    await ctx.db.insert("quickLinkInvites", {
      ownerTokenIdentifier: keyRecord.ownerTokenIdentifier,
      linkId: link._id,
      inviteeUsername,
      createdAt: now,
    });

    await ctx.db.insert("userNotifications", {
      recipientUsername: inviteeUsername,
      kind: "invitation",
      title: "Link invitation",
      message: `@${link.username} shared link /${link.username}/${link.key}`,
      noteId: null,
      linkId: link._id,
      createdAt: now,
      dismissedAt: null,
    });

    await ctx.db.patch(keyRecord._id, { lastUsedAt: now });
    return { invited: true, alreadyInvited: false };
  },
});

export const createWithApiKey = mutation({
  args: {
    apiKey: v.string(),
    key: v.string(),
    targetUrl: v.string(),
    label: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const keyRecord = await resolveApiKey(ctx, args.apiKey);
    if (!keyRecord) throw new Error("Invalid API key");
    if (!hasPermission(keyRecord.permissions, "write")) {
      throw new Error("API key lacks write permission");
    }

    const key = sanitizeKey(args.key);
    const targetUrl = normalizeUrl(args.targetUrl);
    const label = sanitizeLabel(args.label);
    if (!key) throw new Error("Quick link key is required");

    const existing = await ctx.db
      .query("quickLinks")
      .withIndex("by_ownerTokenIdentifier_and_key", (q) =>
        q.eq("ownerTokenIdentifier", keyRecord.ownerTokenIdentifier).eq("key", key)
      )
      .unique();

    if (existing) throw new Error("Quick link key already exists");

    const now = Date.now();
    const id = await ctx.db.insert("quickLinks", {
      ownerTokenIdentifier: keyRecord.ownerTokenIdentifier,
      username: keyRecord.username,
      key,
      targetUrl,
      label,
      clicks: 0,
      createdAt: now,
      updatedAt: now,
      lastClickedAt: null,
    });

    await ctx.db.patch(keyRecord._id, { lastUsedAt: now });
    return { id, key };
  },
});

export const update = mutation({
  args: {
    linkId: v.id("quickLinks"),
    key: v.string(),
    targetUrl: v.string(),
    label: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const link = await ctx.db.get(args.linkId);
    if (!link) throw new Error("Quick link not found");
    if (link.ownerTokenIdentifier !== identity.tokenIdentifier) throw new Error("Forbidden");

    const key = sanitizeKey(args.key);
    const targetUrl = normalizeUrl(args.targetUrl);
    const label = sanitizeLabel(args.label);
    if (!key) throw new Error("Quick link key is required");

    if (key !== link.key) {
      const existing = await ctx.db
        .query("quickLinks")
        .withIndex("by_ownerTokenIdentifier_and_key", (q) =>
          q.eq("ownerTokenIdentifier", identity.tokenIdentifier).eq("key", key)
        )
        .unique();
      if (existing) throw new Error("Quick link key already exists");
    }

    await ctx.db.patch(link._id, {
      key,
      targetUrl,
      label,
      updatedAt: Date.now(),
    });

    return { updated: true };
  },
});

export const updateWithApiKey = mutation({
  args: {
    apiKey: v.string(),
    linkId: v.id("quickLinks"),
    key: v.string(),
    targetUrl: v.string(),
    label: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const keyRecord = await resolveApiKey(ctx, args.apiKey);
    if (!keyRecord) throw new Error("Invalid API key");
    if (!hasPermission(keyRecord.permissions, "write")) {
      throw new Error("API key lacks write permission");
    }

    const link = await ctx.db.get(args.linkId);
    if (!link) throw new Error("Quick link not found");
    if (link.ownerTokenIdentifier !== keyRecord.ownerTokenIdentifier) throw new Error("Forbidden");

    const key = sanitizeKey(args.key);
    const targetUrl = normalizeUrl(args.targetUrl);
    const label = sanitizeLabel(args.label);
    if (!key) throw new Error("Quick link key is required");

    if (key !== link.key) {
      const existing = await ctx.db
        .query("quickLinks")
        .withIndex("by_ownerTokenIdentifier_and_key", (q) =>
          q.eq("ownerTokenIdentifier", keyRecord.ownerTokenIdentifier).eq("key", key)
        )
        .unique();
      if (existing) throw new Error("Quick link key already exists");
    }

    const now = Date.now();
    await ctx.db.patch(link._id, {
      key,
      targetUrl,
      label,
      updatedAt: now,
    });

    await ctx.db.patch(keyRecord._id, { lastUsedAt: now });
    return { updated: true };
  },
});

export const remove = mutation({
  args: {
    linkId: v.id("quickLinks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const link = await ctx.db.get(args.linkId);
    if (!link) return { deleted: true };
    if (link.ownerTokenIdentifier !== identity.tokenIdentifier) throw new Error("Forbidden");

    await ctx.db.delete(link._id);
    return { deleted: true };
  },
});

export const removeWithApiKey = mutation({
  args: {
    apiKey: v.string(),
    linkId: v.id("quickLinks"),
  },
  handler: async (ctx, args) => {
    const keyRecord = await resolveApiKey(ctx, args.apiKey);
    if (!keyRecord) throw new Error("Invalid API key");
    if (!hasPermission(keyRecord.permissions, "write")) {
      throw new Error("API key lacks write permission");
    }

    const link = await ctx.db.get(args.linkId);
    if (!link) return { deleted: true };
    if (link.ownerTokenIdentifier !== keyRecord.ownerTokenIdentifier) throw new Error("Forbidden");

    await ctx.db.delete(link._id);
    await ctx.db.patch(keyRecord._id, { lastUsedAt: Date.now() });
    return { deleted: true };
  },
});

export const trackClick = mutation({
  args: {
    linkId: v.id("quickLinks"),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link) return { tracked: false };

    const now = Date.now();
    const dayKey = dayKeyFromEpoch(now);
    const metricsSlug = `ql__${link.key}`;
    const path = sanitizePath(`/${link.username}/${link.key}`);

    const metric = await ctx.db
      .query("pageMetrics")
      .withIndex("by_ownerTokenIdentifier_and_slug_and_dayKey", (q) =>
        q.eq("ownerTokenIdentifier", link.ownerTokenIdentifier)
          .eq("slug", metricsSlug)
          .eq("dayKey", dayKey)
      )
      .unique();

    if (!metric) {
      await ctx.db.insert("pageMetrics", {
        ownerTokenIdentifier: link.ownerTokenIdentifier,
        username: link.username,
        slug: metricsSlug,
        path,
        dayKey,
        views: 1,
        lastViewedAt: now,
      });
    } else {
      await ctx.db.patch(metric._id, {
        path,
        views: metric.views + 1,
        lastViewedAt: now,
      });
    }

    await ctx.db.patch(link._id, {
      clicks: link.clicks + 1,
      lastClickedAt: now,
      updatedAt: now,
    });

    return { tracked: true };
  },
});
