-- Rollback migration: Remove slug column
DROP INDEX IF EXISTS idx_markdown_posts_slug;
ALTER TABLE markdown_posts DROP COLUMN IF EXISTS slug;