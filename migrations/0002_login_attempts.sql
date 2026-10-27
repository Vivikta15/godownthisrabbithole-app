CREATE TABLE login_attempts (key TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX idx_login_attempts ON login_attempts(key, at);
