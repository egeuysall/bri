import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

function mapPin(pin: Doc<"pins">) {
  return {
    id: pin._id,
    kind: pin.kind,
    noteId: pin.noteId,
    linkId: pin.linkId,
    title: pin.title,
    href: pin.href,
    createdAt: pin.createdAt,
  };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const rows = await ctx.db
      .query("pins")
      .withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
        q.eq("ownerTokenIdentifier", identity.tokenIdentifier)
      )
      .order("desc")
      .take(200);

    const result: Array<ReturnType<typeof mapPin>> = [];
    for (const row of rows) {
      if (row.kind === "note" && row.noteId) {
        const note = await ctx.db.get(row.noteId);
        if (!note || note.state !== "active") continue;
        result.push(
          mapPin({
            ...row,
            title: note.title,
            href: `/${note.username}/${note.slug}`,
          })
        );
        continue;
      }

      if (row.kind === "link" && row.linkId) {
        const link = await ctx.db.get(row.linkId);
        if (!link) continue;
        result.push(
          mapPin({
            ...row,
            title: link.label ?? link.key,
            href: `/${link.username}/${link.key}`,
          })
        );
      }
    }

    return result;
  },
});

export const toggleNote = mutation({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    if (note.ownerTokenIdentifier !== identity.tokenIdentifier) throw new Error("Forbidden");

    const existing = await ctx.db
      .query("pins")
      .withIndex("by_ownerTokenIdentifier_and_kind_and_noteId", (q) =>
        q
          .eq("ownerTokenIdentifier", identity.tokenIdentifier)
          .eq("kind", "note")
          .eq("noteId", args.noteId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { pinned: false, id: existing._id };
    }

    const href = `/${note.username}/${note.slug}`;
    const id = await ctx.db.insert("pins", {
      ownerTokenIdentifier: identity.tokenIdentifier,
      kind: "note",
      noteId: note._id,
      linkId: null,
      title: note.title,
      href,
      createdAt: Date.now(),
    });

    return { pinned: true, id };
  },
});

export const toggleLink = mutation({
  args: {
    linkId: v.id("quickLinks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const link = await ctx.db.get(args.linkId);
    if (!link) throw new Error("Quick link not found");
    if (link.ownerTokenIdentifier !== identity.tokenIdentifier) throw new Error("Forbidden");

    const existing = await ctx.db
      .query("pins")
      .withIndex("by_ownerTokenIdentifier_and_kind_and_linkId", (q) =>
        q
          .eq("ownerTokenIdentifier", identity.tokenIdentifier)
          .eq("kind", "link")
          .eq("linkId", args.linkId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { pinned: false, id: existing._id };
    }

    const href = `/${link.username}/${link.key}`;
    const title = link.label ?? link.key;
    const id = await ctx.db.insert("pins", {
      ownerTokenIdentifier: identity.tokenIdentifier,
      kind: "link",
      noteId: null,
      linkId: link._id,
      title,
      href,
      createdAt: Date.now(),
    });

    return { pinned: true, id };
  },
});
