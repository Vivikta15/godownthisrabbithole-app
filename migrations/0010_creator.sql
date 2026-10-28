-- Creator testing access: one row per user id, set by hand for the owner's own account. Additive only.
CREATE TABLE IF NOT EXISTS creator (user_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
