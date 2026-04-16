import { createHash } from 'node:crypto';
import type { Post } from '@/types/general';
import { isMarkdownAlias, stripMarkdownAlias } from '@/lib/post-slugs';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type MarkdownPostRow = {
  id: string;
  slug: string;
  content: string;
  created_at: string;
};

const POST_COLUMNS = 'id, slug, content, created_at';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapPost(row: MarkdownPostRow): Post {
  return {
    id: row.id,
    slug: row.slug,
    content: row.content,
    createdAt: row.created_at,
  };
}

function generateSlug(content: string): string {
  return createHash('sha256').update(content).digest().subarray(0, 4).toString('base64url');
}

async function findPostBySlug(slug: string): Promise<Post | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('markdown_posts')
    .select(POST_COLUMNS)
    .eq('slug', slug)
    .maybeSingle<MarkdownPostRow>();

  if (error) {
    console.error('Failed to fetch post by slug:', error);
    return null;
  }

  return data ? mapPost(data) : null;
}

async function findPostById(id: string): Promise<Post | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('markdown_posts')
    .select(POST_COLUMNS)
    .eq('id', id)
    .maybeSingle<MarkdownPostRow>();

  if (error) {
    console.error('Failed to fetch post by id:', error);
    return null;
  }

  return data ? mapPost(data) : null;
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

  if (!UUID_PATTERN.test(normalizedIdentifier)) {
    return null;
  }

  return findPostById(normalizedIdentifier);
}

export async function createPost(input: {
  content: string;
  slug?: string;
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

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('markdown_posts')
    .insert({
      slug,
      content,
    })
    .select('slug')
    .single<{ slug: string }>();

  if (error) {
    if (error.code === '23505') {
      const duplicatePost = await findPostBySlug(slug);

      if (duplicatePost) {
        return {
          created: false,
          slug: duplicatePost.slug,
        };
      }
    }

    console.error('Failed to create post:', error);
    throw new Error('Failed to create post');
  }

  if (!data?.slug) {
    throw new Error('Invalid post ID received from server');
  }

  return {
    created: true,
    slug: data.slug,
  };
}
