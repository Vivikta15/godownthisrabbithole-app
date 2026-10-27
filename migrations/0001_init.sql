CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pw_hash TEXT NOT NULL, pw_salt TEXT NOT NULL, display_name TEXT, timezone TEXT NOT NULL DEFAULT 'UTC', signup_at INTEGER NOT NULL, onboarded_at INTEGER);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE TABLE preferences (user_id TEXT PRIMARY KEY REFERENCES users(id), interest_tags TEXT NOT NULL, formats TEXT NOT NULL, length_pref TEXT, quiz_answers TEXT);
CREATE TABLE rabbit_holes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), day TEXT NOT NULL, topic_id TEXT NOT NULL, format TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, sources TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id, day));
CREATE TABLE read_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, hole_id TEXT NOT NULL, topic_tags TEXT NOT NULL, format TEXT NOT NULL, seconds_read INTEGER NOT NULL, completed INTEGER NOT NULL, day TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE streaks (user_id TEXT PRIMARY KEY, current INTEGER NOT NULL, longest INTEGER NOT NULL, last_read_day TEXT, freezes_left INTEGER NOT NULL, bonus_holes INTEGER NOT NULL DEFAULT 0);
CREATE TABLE finder_uses (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, word_a TEXT NOT NULL, word_b TEXT NOT NULL, result TEXT, sources TEXT, created_at INTEGER NOT NULL);
CREATE TABLE friendships (user_id TEXT NOT NULL, friend_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id, friend_id));
CREATE TABLE invites (code TEXT PRIMARY KEY, inviter_id TEXT NOT NULL, created_at INTEGER NOT NULL);
-- entitlements are written ONLY by verified payment webhooks
CREATE TABLE subscriptions (user_id TEXT PRIMARY KEY, plan TEXT, status TEXT NOT NULL, dodo_subscription_id TEXT, paid_through INTEGER, updated_at INTEGER NOT NULL);
CREATE TABLE webhook_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, received_at INTEGER NOT NULL);
