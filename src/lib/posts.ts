import { createHash } from 'node:crypto';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '../../convex/_generated/api';
import { isMarkdownAlias, stripMarkdownAlias } from '@/lib/post-slugs';

interface Post {
  id: string;
  slug: string;
  content: string;
  createdAt: string;
}

type MarkdownPost = {
  id: string;
  slug: string;
  content: string;
  createdAt: string;
};

function mapPost(post: MarkdownPost): Post {
  return {
    id: post.id,
    slug: post.slug,
    content: post.content,
    createdAt: post.createdAt,
  };
}

function generateSlug(content: string): string {
  return createHash('sha256').update(content).digest().subarray(0, 4).toString('base64url');
}

async function findPostBySlug(slug: string): Promise<Post | null> {
  try {
    const data = await fetchQuery(api.posts.getBySlug, { slug });
    return data ? mapPost(data) : null;
  } catch (error) {
    console.error('Failed to fetch post by slug:', error);
    return null;
  }
}

export async function getPost(identifier: string): Promise<Post | null> {
  const normalizedIdentifier = identifier.trim();

  if (!normalizedIdentifier) {
    return null;
  }

  const postBySlug = await findPostBySlug(normalizedIdentifier);
  if (postBySlug) {
    return postBySlug;
  }

  if (isMarkdownAlias(normalizedIdentifier)) {
    const aliasedSlug = stripMarkdownAlias(normalizedIdentifier).trim();

    if (!aliasedSlug) {
      return null;
    }

    const postByMarkdownAlias = await findPostBySlug(aliasedSlug);
    if (postByMarkdownAlias) {
      return postByMarkdownAlias;
    }
  }

  return null;
}

export async function createPost(input: {
  content: string;
  slug?: string;
  token: string;
}): Promise<{ created: boolean; slug: string }> {
  const content = input.content.trim();

  if (!content) {
    throw new Error('Content cannot be empty');
  }

  const slug = input.slug?.trim() || generateSlug(content);

  if (isMarkdownAlias(slug)) {
    throw new Error('Slug cannot end with .md');
  }

  const existingPost = await findPostBySlug(slug);

  if (existingPost) {
    return {
      created: false,
      slug: existingPost.slug,
    };
  }

  try {
    return await fetchMutation(
      api.posts.create,
      {
        slug,
        content,
      },
      {
        token: input.token,
      }
    );
  } catch (error) {
    console.error('Failed to create post:', error);
    throw error instanceof Error ? error : new Error('Failed to create post');
  }
}
