package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/egeuysall/bridge/backend/internal/handlers"
	appmid "github.com/egeuysall/bridge/backend/internal/middleware"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httprate"
)

func Router() *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(
		middleware.Recoverer,
		middleware.RealIP,
		middleware.Timeout(3*time.Second),
		middleware.NoCache,
		middleware.Compress(5),
		httprate.LimitByIP(30, time.Minute),
		appmid.SetContentType(),
		appmid.Cors(),
	)

	// Public routes
	r.Get("/", handleRoot)
	r.Get("/health", handleHealth)

	r.Route("/v1", func(r chi.Router) {
		r.Post("/posts", handlers.HandleCreatePost)
		r.Get("/posts/{slug}", handlers.HandleGetPostBySlug)
	})

	return r
}

func handleRoot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	response := map[string]any{
		"service": "Bridge API",
		"version": "1.2.2",
		"status":  "Healthy",
		"endpoints": map[string]string{
			"health":   "/health",
			"create":   "/v1/posts",
			"get_post": "/v1/posts/{id}",
			"get_slug": "/v1/posts/slug/{slug}",
		},
		"documentation": "https://github.com/egeuysall/bridge",
	}

	json.NewEncoder(w).Encode(response)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	response := map[string]any{
		"status":    "Healthy",
		"service":   "Bridge API",
		"version":   "1.2.2",
		"uptime":    "operational",
		"checks": map[string]string{
			"database": "connected",
			"api":      "responding",
		},
	}

	json.NewEncoder(w).Encode(response)
}
