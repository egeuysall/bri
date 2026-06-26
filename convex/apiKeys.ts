import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

type Permission = "read" | "write" | "read_write";

function sanitizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function mapApiKey(record: {
  _id: string;
  prefix: string;
  permissions: Permission;
  label: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}) {
  return {
    id: record._id,
    prefix: record.prefix,
    permissions: record.permissions,
    label: record.label,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt,
  };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const rows = await ctx.db
      .query("apiKeys")
      .withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
        q.eq("ownerTokenIdentifier", identity.tokenIdentifier)
      )
      .order("desc")
      .take(100);

    return rows.map(mapApiKey);
  },
});

export const createHashed = mutation({
  args: {
    username: v.string(),
    prefix: v.string(),
    keyHash: v.string(),
    permissions: v.union(v.literal("read"), v.literal("write"), v.literal("read_write")),
    label: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const username = sanitizeUsername(args.username);
    const prefix = args.prefix.trim();
    const keyHash = args.keyHash.trim().toLowerCase();

    if (!username) throw new Error("Username is required");
    if (!prefix.startsWith("bri_")) throw new Error("Invalid key prefix");
    if (!/^[a-f0-9]{64}$/.test(keyHash)) throw new Error("Invalid key hash");

    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_prefix", (q) => q.eq("prefix", prefix))
      .unique();

    if (existing) throw new Error("API key prefix collision");

    const now = Date.now();
    const id = await ctx.db.insert("apiKeys", {
      ownerTokenIdentifier: identity.tokenIdentifier,
      username,
      prefix,
      keyHash,
      permissions: args.permissions,
      label: args.label,
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    });

    return { id };
  },
});

export const revokeMine = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const record = await ctx.db.get(args.keyId);
    if (!record) return { revoked: true };
    if (record.ownerTokenIdentifier !== identity.tokenIdentifier) throw new Error("Forbidden");

    await ctx.db.patch(record._id, { revokedAt: Date.now() });
    return { revoked: true };
  },
});

export const verifyHashed = query({
  args: {
    prefix: v.string(),
    keyHash: v.string(),
  },
  handler: async (ctx, args) => {
    const prefix = args.prefix.trim();
    const keyHash = args.keyHash.trim().toLowerCase();
    if (!prefix.startsWith("bri_") || !/^[a-f0-9]{64}$/.test(keyHash)) {
      return null;
    }

    const record = await ctx.db
      .query("apiKeys")
      .withIndex("by_prefix", (q) => q.eq("prefix", prefix))
      .unique();

    if (!record || record.revokedAt !== null || record.keyHash !== keyHash) {
      return null;
    }

    return {
      prefix: record.prefix,
      permissions: record.permissions,
      label: record.label,
      username: record.username,
    };
  },
});
