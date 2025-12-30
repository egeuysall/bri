-- name: CreatePost :one
INSERT INTO markdown_posts (slug, content)
VALUES ($1, $2)
    RETURNING id, slug;

-- name: GetPostByID :one
SELECT id, slug, content, created_at
FROM markdown_posts
WHERE id = $1;

-- name: GetPostBySlug :one
SELECT id, slug, content, created_at
FROM markdown_posts
WHERE slug = $1;
