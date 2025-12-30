package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/egeuysall/bridge/backend/internal/models"
	supabase "github.com/egeuysall/bridge/backend/internal/supabase/generated"
	"github.com/egeuysall/bridge/backend/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func HandleGetPost(w http.ResponseWriter, r *http.Request) {
	postIDStr := chi.URLParam(r, "id")
	if postIDStr == "" {
		utils.SendError(w, "Missing postId parameter", http.StatusBadRequest)
		return
	}

	var postID pgtype.UUID
	if err := postID.Scan(postIDStr); err != nil {
		utils.SendError(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	post, err := utils.Queries.GetPostByID(r.Context(), postID)
	if err != nil {
		if err == pgx.ErrNoRows {
			utils.SendError(w, "Post not found", http.StatusNotFound)
			return
		}
		utils.SendError(w, "Failed to get post", http.StatusInternalServerError)
		return
	}

	resp := models.Post{
		ID:        post.ID.String(),
		Slug:      post.Slug.String,
		Content:   post.Content,
		CreatedAt: post.CreatedAt.Time,
	}

	utils.SendJson(w, resp, http.StatusOK)
}

// HandleCreatePost creates a new post
func HandleCreatePost(w http.ResponseWriter, r *http.Request) {
	var req models.Post
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.SendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		utils.SendError(w, "Content cannot be empty", http.StatusBadRequest)
		return
	}

	// Generate slug from content (will be overwritten if slug is provided)
	// Note: We use empty filename here since we don't have file info in API context
	// The CLI tool (main.go) generates proper filename-based slugs
	slug := utils.GenerateSlug("", req.Content)

	// Use provided slug if available, otherwise generate from content
	if req.Slug != "" {
		slug = req.Slug
	}

	// Check if post with this slug already exists
	slugText := pgtype.Text{String: slug, Valid: true}
	existingPost, err := utils.Queries.GetPostBySlug(r.Context(), slugText)
	if err == nil {
		// Post already exists, return existing slug
		resp := map[string]string{
			"slug": existingPost.Slug.String,
		}
		utils.SendJson(w, resp, http.StatusOK)
		return
	}

	// Create new post
	createParams := supabase.CreatePostParams{
		Slug:    slugText,
		Content: req.Content,
	}
	newPost, err := utils.Queries.CreatePost(r.Context(), createParams)
	if err != nil {
		utils.SendError(w, "Failed to create post", http.StatusInternalServerError)
		return
	}

	resp := map[string]string{
		"slug": newPost.Slug.String,
	}

	utils.SendJson(w, resp, http.StatusCreated)
}

func HandleGetPostBySlug(w http.ResponseWriter, r *http.Request) {
	slugStr := chi.URLParam(r, "slug")
	if slugStr == "" {
		utils.SendError(w, "Missing slug parameter", http.StatusBadRequest)
		return
	}

	var slug pgtype.Text
	if err := slug.Scan(slugStr); err != nil {
		utils.SendError(w, "Invalid slug", http.StatusBadRequest)
		return
	}

	post, err := utils.Queries.GetPostBySlug(r.Context(), slug)
	if err != nil {
		if err == pgx.ErrNoRows {
			utils.SendError(w, "Post not found", http.StatusNotFound)
			return
		}
		utils.SendError(w, "Failed to get post", http.StatusInternalServerError)
		return
	}

	resp := models.Post{
		ID:        post.ID.String(),
		Slug:      post.Slug.String,
		Content:   post.Content,
		CreatedAt: post.CreatedAt.Time,
	}

	utils.SendJson(w, resp, http.StatusOK)
}
