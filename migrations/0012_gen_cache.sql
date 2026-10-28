-- Resumable generator steps: every external response and model reply of an in-flight attempt, replayed on the next tick. Additive. Rows are deleted when the attempt ends.
CREATE TABLE IF NOT EXISTS gen_cache (attempt TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (attempt, k));
