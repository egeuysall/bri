import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

type PostRecord = {
  id: string;
  slug: string;
  content: string;
  createdAt: string;
};

function mapPost(post: {
  _id: string;
  _creationTime: number;
  slug: string;
  content: string;
}): PostRecord {
  return {
    id: post._id,
    slug: post.slug,
    content: post.content,
    createdAt: new Date(post._creationTime).toISOString(),
  };
}

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const slug = args.slug.trim();
    if (!slug) {
      return null;
    }

    const post = await ctx.db
      .query("markdownPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    return post ? mapPost(post) : null;
  },
});

export const getById = query({
  args: { id: v.id("markdownPosts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    return post ? mapPost(post) : null;
  },
});

export const create = mutation({
  args: {
    slug: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const slug = args.slug.trim();
    const content = args.content.trim();

    if (!content) {
      throw new Error("Content cannot be empty");
    }

    if (!slug) {
      throw new Error("Slug cannot be empty");
    }

    if (slug.toLowerCase().endsWith(".md")) {
      throw new Error("Slug cannot end with .md");
    }

    const existingPost = await ctx.db
      .query("markdownPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (existingPost) {
      return {
        created: false,
        slug: existingPost.slug,
      };
    }

    await ctx.db.insert("markdownPosts", { slug, content });

    return {
      created: true,
      slug,
    };
  },
});
