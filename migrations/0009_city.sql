-- Optional weather city, one row per user. Additive only; coordinates are rounded to 2 decimals (about 1 km).
CREATE TABLE user_city (user_id TEXT PRIMARY KEY REFERENCES users(id), city_id INTEGER NOT NULL, name TEXT NOT NULL, country TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, updated_at INTEGER NOT NULL);
