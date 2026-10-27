CREATE TABLE auth_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, used_at INTEGER, created_at INTEGER NOT NULL);
CREATE INDEX auth_tokens_user ON auth_tokens (user_id, kind);
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
