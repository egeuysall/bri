package models

import "time"

type Post struct {
	ID        string    `json:"id"`
	Slug      string    `json:"slug"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}
