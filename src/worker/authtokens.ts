// Single-use, expiring, hashed tokens for password reset and email verification. Only the SHA-256 of a token is stored.
export type TokenKind = 'reset' | 'verify';
export const TTL_MS: Record<TokenKind, number> = { reset: 60 * 60 * 1000, verify: 24 * 60 * 60 * 1000 };
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const hashToken = async (raw: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(raw)));
export const newRawToken = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer);

export async function createToken(db: D1Database, userId: string, kind: TokenKind, now = Date.now()): Promise<string> {
  const raw = newRawToken();
  // a new token invalidates older unused tokens of the same kind for that user
  await db.batch([
    db.prepare('UPDATE auth_tokens SET used_at=? WHERE user_id=? AND kind=? AND used_at IS NULL').bind(now, userId, kind),
    db.prepare('INSERT INTO auth_tokens (id,user_id,kind,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(), userId, kind, await hashToken(raw), now + TTL_MS[kind], now),
  ]);
  return raw;
}
/** Atomically spends a token. Returns the user id, or null if unknown, wrong kind, expired or already used. */
export async function consumeToken(db: D1Database, raw: string, kind: TokenKind, now = Date.now()): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(raw)) return null;
  const h = await hashToken(raw);
  const r = await db.prepare('UPDATE auth_tokens SET used_at=? WHERE token_hash=? AND kind=? AND used_at IS NULL AND expires_at>?').bind(now, h, kind, now).run();
  if (r.meta.changes !== 1) return null;
  const row = await db.prepare('SELECT user_id FROM auth_tokens WHERE token_hash=?').bind(h).first<{ user_id: string }>();
  return row?.user_id ?? null;
}
