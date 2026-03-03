package utils

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

// GenerateSlug creates a slug from filename and short hash.
func GenerateSlug(filename, content string) string {
	base := filepath.Base(filename)
	ext := filepath.Ext(base)
	name := base[:len(base)-len(ext)]

	re := regexp.MustCompile(`[^a-zA-Z0-9\-]`)
	name = strings.ToLower(name)
	name = strings.ReplaceAll(name, "_", "-")
	name = strings.ReplaceAll(name, " ", "-")
	name = re.ReplaceAllString(name, "")

	words := strings.Split(name, "-")
	if len(words) > 3 {
		words = words[:3]
	}

	name = strings.Join(words, "-")
	if len(name) > 20 {
		name = name[:20]
	}

	name = strings.TrimRight(name, "-")

	hash := sha256.Sum256([]byte(content))
	shortHash := base64.URLEncoding.EncodeToString(hash[:4])
	shortHash = strings.TrimRight(shortHash, "=")

	if name == "" {
		return shortHash
	}

	return fmt.Sprintf("%s--%s", name, shortHash)
}
