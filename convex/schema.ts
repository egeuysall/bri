import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  markdownPosts: defineTable({
    slug: v.string(),
    content: v.string(),
  }).index("by_slug", ["slug"]),
  notes: defineTable({
    ownerTokenIdentifier: v.string(),
    username: v.string(),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    visibility: v.union(v.literal("public"), v.literal("private")),
    state: v.union(v.literal("active"), v.literal("deleted")),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.union(v.number(), v.null()),
    deletedAt: v.union(v.number(), v.null()),
    purgeAt: v.union(v.number(), v.null()),
  })
    .index("by_username_and_slug", ["username", "slug"])
    .index("by_ownerTokenIdentifier_and_slug", ["ownerTokenIdentifier", "slug"])
    .index("by_ownerTokenIdentifier_and_state_and_createdAt", [
      "ownerTokenIdentifier",
      "state",
      "createdAt",
    ])
    .index("by_state_and_purgeAt", ["state", "purgeAt"]),
  apiKeys: defineTable({
    ownerTokenIdentifier: v.string(),
    username: v.string(),
    prefix: v.string(),
    keyHash: v.string(),
    permissions: v.union(v.literal("read"), v.literal("write"), v.literal("read_write")),
    label: v.union(v.string(), v.null()),
    createdAt: v.number(),
    lastUsedAt: v.union(v.number(), v.null()),
    revokedAt: v.union(v.number(), v.null()),
  })
    .index("by_prefix", ["prefix"])
    .index("by_ownerTokenIdentifier_and_createdAt", ["ownerTokenIdentifier", "createdAt"]),
});
