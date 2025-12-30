-- Add slug column back to markdown_posts table
ALTER TABLE markdown_posts ADD COLUMN slug TEXT UNIQUE;

-- Create unique index on slug
CREATE UNIQUE INDEX idx_markdown_posts_slug ON markdown_posts(slug);