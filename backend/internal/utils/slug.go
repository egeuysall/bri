package utils

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

// GenerateSlug creates a slug from filename and short hash
// Format: {filename}-{short-id}
// Example: i-like-apples-1f3a9
// Max length: 12 characters for filename part + 1 for dash + 6 for hash = 19 chars total
func GenerateSlug(filename, content string) string {
	// Extract filename without extension
	base := filepath.Base(filename)
	ext := filepath.Ext(base)
	name := base[:len(base)-len(ext)]

	// Clean filename: convert to lowercase, replace spaces/underscores with hyphens
	re := regexp.MustCompile(`[^a-zA-Z0-9\-]`)
	name = strings.ToLower(name)
	name = strings.ReplaceAll(name, "_", "-")
	name = strings.ReplaceAll(name, " ", "-")
	name = re.ReplaceAllString(name, "")

	// Limit filename part to max 12 characters
	if len(name) > 12 {
		name = name[:12]
	}

	// Remove any trailing hyphens from the name
	name = strings.TrimRight(name, "-")

	// Generate short hash from content (6 characters)
	hash := sha256.Sum256([]byte(content))
	shortHash := base64.URLEncoding.EncodeToString(hash[:4])
	shortHash = strings.TrimRight(shortHash, "=")

	// If name is empty after cleaning, just use hash
	if name == "" {
		return shortHash
	}

	return fmt.Sprintf("%s-%s", name, shortHash)
}
