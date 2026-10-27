-- Lifetime reservation ledger for the optional paid Anthropic trial (micro-dollars). One row. Off unless env enables it.
CREATE TABLE paid_spend (id INTEGER PRIMARY KEY CHECK (id = 1), reserved_microusd INTEGER NOT NULL DEFAULT 0);
INSERT INTO paid_spend (id, reserved_microusd) VALUES (1, 0);
