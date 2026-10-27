-- Saved discoveries: one row per (user, topic). Additive only.
CREATE TABLE saved (user_id TEXT NOT NULL, topic_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, topic_id));
