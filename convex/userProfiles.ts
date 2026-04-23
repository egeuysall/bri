import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function sanitizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
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

export const syncMine = mutation({
  args: {
    username: v.string(),
    displayName: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const username = sanitizeUsername(args.username);
    if (!username) throw new Error("Username is required");

    const displayName = cleanDisplayName(args.displayName);
    const email = cleanEmail(args.email);
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
      return { synced: true };
    }

    await ctx.db.insert("userProfiles", {
      ownerTokenIdentifier: identity.tokenIdentifier,
      username,
      displayName,
      email,
      createdAt: now,
      updatedAt: now,
    });
    return { synced: true };
  },
});

export const getPublicByUsername = query({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const username = sanitizeUsername(args.username);
    if (!username) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (!profile) return null;

    return {
      username: profile.username,
      displayName: profile.displayName,
      email: profile.email,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  },
});

export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_ownerTokenIdentifier", (q) =>
        q.eq("ownerTokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!profile) return null;

    return {
      username: profile.username,
      displayName: profile.displayName,
      email: profile.email,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  },
});
