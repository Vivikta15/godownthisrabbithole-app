-- Autonomous story generator storage. Additive only. Inert until GEN_ENABLED is set and a key exists.
-- gen_spend_log: every paid call reserves BEFORE it is made. Success settles to provider-reported usage; failures keep the full reservation.
CREATE TABLE IF NOT EXISTS gen_spend_log (id TEXT PRIMARY KEY, ts INTEGER NOT NULL, micro INTEGER NOT NULL, state TEXT NOT NULL, note TEXT);
CREATE INDEX IF NOT EXISTS gen_spend_ts ON gen_spend_log (ts);
CREATE TABLE IF NOT EXISTS gen_story (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, body TEXT NOT NULL, meta TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS gen_attempt (id TEXT PRIMARY KEY, ts INTEGER NOT NULL, topic TEXT, outcome TEXT NOT NULL, reason TEXT, micro INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS gen_control (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at INTEGER NOT NULL);
