import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function normalizeImageType(value: string) {
  const contentType = value.trim().toLowerCase();
  return IMAGE_TYPES.has(contentType) ? contentType : null;
}

function assertUploadArgs(args: { contentType: string; size: number }) {
  const contentType = normalizeImageType(args.contentType);
  if (!contentType) {
    throw new Error("Only PNG, JPEG, GIF, WebP, and AVIF images are supported");
  }
  if (!Number.isInteger(args.size) || args.size <= 0 || args.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Images must be 20 MB or smaller");
  }
  return contentType;
}

export const generateUploadUrl = mutation({
  args: {
    contentType: v.string(),
    size: v.number(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    assertUploadArgs(args);
    return await ctx.storage.generateUploadUrl();
  },
});

export const completeUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    contentType: v.string(),
    size: v.number(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const contentType = assertUploadArgs(args);
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (
      !metadata ||
      metadata.size !== args.size ||
      metadata.contentType?.toLowerCase() !== contentType
    ) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Uploaded file could not be verified");
    }

    const existing = await ctx.db
      .query("files")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("files", {
      storageId: args.storageId,
      ownerTokenIdentifier: identity.tokenIdentifier,
      contentType,
      size: metadata.size,
      name: args.name.trim().slice(0, 200),
      createdAt: Date.now(),
    });
  },
});

export const getUrl = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query("files")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.fileId))
      .unique();
    if (!file) return null;

    const metadata = await ctx.db.system.get("_storage", args.fileId);
    if (
      !metadata ||
      metadata.size !== file.size ||
      metadata.contentType?.toLowerCase() !== file.contentType
    ) {
      return null;
    }

    return await ctx.storage.getUrl(args.fileId);
  },
});
