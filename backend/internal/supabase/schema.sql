-- schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE markdown_posts (
                                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                slug TEXT UNIQUE,
                                content TEXT NOT NULL,
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
