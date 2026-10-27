import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { SEED, TOPIC_TAGS, FORMATS } from '../content/seed';
import { PLANS } from '../shared/config';
import { accessFor, finderUsesAllowed, type Account } from '../shared/entitlements';
import { recordRead, displayStreak, localDay, type StreakState } from '../shared/streak';
import { pickTopic, type ReadEvent } from '../shared/recommend';
import { verifyWebhook } from './webhook';
import { mapSubscriptionEvent } from './billing';
import { createCheckout } from './checkout';
import { shapeBeats } from '../shared/shape';

type Env = { DB: D1Database; ASSETS: Fetcher; DODO_WEBHOOK_SECRET?: string; DODO_PRODUCT_MAP?: string; BONUS_CHANCE?: string; DODO_API_KEY?: string; DODO_ENV?: string; APP_URL?: string; CHECKOUT_ENABLED?: string };
type Vars = { uid: string };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const rid = () => crypto.randomUUID();
async function hashPw(pw: string, salt: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, k, 256));
}
// UNDECIDED product rule: the chance of earning a bonus rabbit hole after a completed read. Set env BONUS_CHANCE (0..1). Unset = 0 = nobody earns bonuses.
const bonusChance = (v?: string) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; };
const ctEq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

app.use('*', async (c, next) => {
  await next();
  c.res = new Response(c.res.body, c.res);
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('Referrer-Policy', 'same-origin');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'");
});
// CSRF defence in depth on top of SameSite=Lax: state-changing browser requests must come from our own origin.
app.use('/api/*', async (c, next) => {
  const m = c.req.method; const p = new URL(c.req.url).pathname;
  if (m !== 'GET' && m !== 'HEAD' && p !== '/api/webhooks/dodo') {
    const o = c.req.header('origin'); if (o && o !== new URL(c.req.url).origin) return c.json({ error: 'bad origin' }, 403);
  }
  await next();
});
app.onError((e, c) => (e instanceof SyntaxError ? c.json({ error: 'bad json' }, 400) : c.json({ error: 'server' }, 500)));

app.use('/api/*', async (c, next) => {
  const p = new URL(c.req.url).pathname;
  if (['/api/signup', '/api/login', '/api/config', '/api/webhooks/dodo'].includes(p)) return next();
  const sid = getCookie(c, 'sid');
  if (!sid) return c.json({ error: 'auth' }, 401);
  const row = await c.env.DB.prepare('SELECT user_id FROM sessions WHERE id=? AND expires_at>?').bind(sid, Date.now()).first<{ user_id: string }>();
  if (!row) return c.json({ error: 'auth' }, 401);
  c.set('uid', row.user_id);
  return next();
});

async function startSession(c: any, uid: string) {
  const sid = rid() + rid();
  await c.env.DB.prepare('INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)').bind(sid, uid, Date.now() + 30 * 86400000).run();
  setCookie(c, 'sid', sid, { httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Lax', path: '/', maxAge: 30 * 86400 });
}

app.get('/api/config', (c) => c.json({ topics: TOPIC_TAGS, formats: FORMATS, plans: PLANS, finderGenerator: false, payments: c.env.CHECKOUT_ENABLED === 'true' && c.env.DODO_API_KEY && c.env.DODO_ENV !== 'live_mode' ? 'test_mode' : 'not_configured' }));

app.post('/api/signup', async (c) => {
  const b = await c.req.json<{ email: string; password: string; name?: string; timezone?: string }>();
  const email = (b.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || (b.password || '').length < 8) return c.json({ error: 'Use a valid email and a password of 8+ characters.' }, 400);
  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if (exists) return c.json({ error: 'That email already has an account.' }, 409);
  const id = rid(); const salt = rid();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users (id,email,pw_hash,pw_salt,display_name,timezone,signup_at) VALUES (?,?,?,?,?,?,?)').bind(id, email, await hashPw(b.password, salt), salt, b.name ? String(b.name).slice(0, 40) : null, b.timezone || 'UTC', Date.now()),
    c.env.DB.prepare('INSERT INTO streaks (user_id,current,longest,last_read_day,freezes_left,bonus_holes) VALUES (?,0,0,NULL,?,0)').bind(id, PLANS.trial.streak_freezes ?? 0),
  ]);
  await startSession(c, id);
  return c.json({ ok: true });
});

app.post('/api/login', async (c) => {
  const b = await c.req.json<{ email: string; password: string }>();
  const email = String(b.email || '').trim().toLowerCase().slice(0, 254);
  // throttle: max 8 failed attempts per email per 15 min (also bounds password guessing)
  const key = 'e:' + email; const since = Date.now() - 15 * 60000;
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key=? AND at>?').bind(key, since).first<{ n: number }>();
  if ((n?.n ?? 0) >= 8) return c.json({ error: 'Too many tries. Please wait a few minutes.' }, 429);
  const u = await c.env.DB.prepare('SELECT id,pw_hash,pw_salt FROM users WHERE email=?').bind(email).first<any>();
  const good = u ? ctEq(await hashPw(String(b.password || ''), u.pw_salt), u.pw_hash) : (await hashPw(String(b.password || ''), 'x'), false);
  if (!good) { await c.env.DB.prepare('INSERT INTO login_attempts (key,at) VALUES (?,?)').bind(key, Date.now()).run(); return c.json({ error: 'Email or password did not match.' }, 401); }
  await c.env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
  await startSession(c, u.id);
  return c.json({ ok: true });
});
app.post('/api/logout', async (c) => { const sid = getCookie(c, 'sid'); if (sid) await c.env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run(); deleteCookie(c, 'sid', { path: '/' }); return c.json({ ok: true }); });

async function loadAll(c: any) {
  const uid = c.get('uid');
  const u = await c.env.DB.prepare('SELECT id,email,display_name,timezone,signup_at,onboarded_at FROM users WHERE id=?').bind(uid).first();
  const s = await c.env.DB.prepare('SELECT current,longest,last_read_day,freezes_left,bonus_holes FROM streaks WHERE user_id=?').bind(uid).first();
  const sub = await c.env.DB.prepare('SELECT plan,status,paid_through FROM subscriptions WHERE user_id=?').bind(uid).first();
  const pref = await c.env.DB.prepare('SELECT interest_tags,formats,length_pref FROM preferences WHERE user_id=?').bind(uid).first();
  return { u, s, sub, pref };
}
function accessOf(u: any, sub: any) {
  const acct: Account = { signupAt: new Date(u.signup_at), paidPlan: sub?.plan ?? null, subscriptionStatus: sub?.status ?? 'none', paidThrough: sub?.paid_through ? new Date(sub.paid_through) : null };
  return accessFor(acct, new Date());
}

app.get('/api/me', async (c) => {
  const { u, s, sub, pref } = await loadAll(c);
  const today = localDay(new Date(), u.timezone);
  const access = accessOf(u, sub);
  const streak: StreakState = { current: s.current, longest: s.longest, lastReadDay: s.last_read_day, freezesLeft: s.freezes_left };
  const readToday = s.last_read_day === today;
  return c.json({
    user: { email: u.email, name: u.display_name, onboarded: !!u.onboarded_at, timezone: u.timezone },
    access: { plan: access.plan, rabbitHoles: access.rabbitHoles, finderQuota: access.finderQuota, trialEndsAt: access.trialEndsAt },
    streak: { current: displayStreak(streak, today), longest: s.longest, freezesLeft: s.freezes_left, bonusHoles: s.bonus_holes, readToday },
    prefs: pref ? { interestTags: JSON.parse(pref.interest_tags), formats: JSON.parse(pref.formats), length: pref.length_pref } : null,
  });
});

app.post('/api/quiz', async (c) => {
  const b = await c.req.json<{ interestTags: string[]; formats: string[]; length?: string }>();
  const tags = (b.interestTags || []).filter((t) => TOPIC_TAGS.includes(t)); const fmts = (b.formats || []).filter((f) => FORMATS.some((x) => x.id === f));
  if (!tags.length || !fmts.length) return c.json({ error: 'Pick at least one topic and one style.' }, 400);
  const uid = c.get('uid');
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT OR REPLACE INTO preferences (user_id,interest_tags,formats,length_pref,quiz_answers) VALUES (?,?,?,?,?)').bind(uid, JSON.stringify(tags), JSON.stringify(fmts), b.length || null, JSON.stringify(b)),
    c.env.DB.prepare('UPDATE users SET onboarded_at=COALESCE(onboarded_at,?) WHERE id=?').bind(Date.now(), uid),
  ]);
  return c.json({ ok: true });
});

async function recentEvents(c: any, uid: string): Promise<ReadEvent[]> {
  const r = await c.env.DB.prepare('SELECT topic_tags,format,seconds_read,completed,day FROM read_events WHERE user_id=? ORDER BY created_at DESC LIMIT 60').bind(uid).all();
  return (r.results as any[]).reverse().map((e) => ({ topicTags: JSON.parse(e.topic_tags), format: e.format, secondsRead: e.seconds_read, completed: !!e.completed, day: e.day }));
}

app.get('/api/today', async (c) => {
  const { u, s, sub, pref } = await loadAll(c);
  if (!pref) return c.json({ error: 'onboarding' }, 409);
  const access = accessOf(u, sub);
  if (!access.rabbitHoles) return c.json({ error: 'paywall', message: 'Your 3-day trial has ended.' }, 402);
  const day = localDay(new Date(), u.timezone);
  let row = await c.env.DB.prepare('SELECT id,topic_id,format,title FROM rabbit_holes WHERE user_id=? AND day=?').bind(u.id, day).first<any>();
  let why = '';
  const profile = { interestTags: JSON.parse(pref.interest_tags), formats: JSON.parse(pref.formats) };
  if (!row) {
    const seen = ((await c.env.DB.prepare('SELECT topic_id FROM rabbit_holes WHERE user_id=?').bind(u.id).all()).results as any[]).map((r) => r.topic_id);
    const events = await recentEvents(c, u.id);
    const n = seen.length;
    let pick = pickTopic(SEED.map((t) => ({ id: t.id, tags: t.tags, formats: FORMATS.map((f) => f.id) })), seen, events, profile, n > 0 && n % 4 === 3);
    if (!pick) pick = pickTopic(SEED.map((t) => ({ id: t.id, tags: t.tags, formats: FORMATS.map((f) => f.id) })), [], events, profile);
    if (!pick) return c.json({ error: 'no content' }, 500);
    const seed = SEED.find((t) => t.id === pick.topic.id)!;
    const id = rid();
    // UNIQUE(user_id,day) makes concurrent first opens safe: the loser re-reads the winner's row.
    await c.env.DB.prepare('INSERT OR IGNORE INTO rabbit_holes (id,user_id,day,topic_id,format,title,body,sources,verified) VALUES (?,?,?,?,?,?,?,?,0)')
      .bind(id, u.id, day, seed.id, pick.format, seed.title, JSON.stringify({ hook: seed.hook, beats: seed.beats }), JSON.stringify(seed.sources)).run();
    row = await c.env.DB.prepare('SELECT id,topic_id,format,title FROM rabbit_holes WHERE user_id=? AND day=?').bind(u.id, day).first<any>();
  }
  const seed = SEED.find((t) => t.id === row.topic_id)!;
  const matched = seed.tags.filter((t) => profile.interestTags.includes(t));
  why = matched.length ? `Because you like ${matched.join(' and ')}.` : 'A fresh corner to explore, to keep things from getting samey.';
  return c.json({ hole: { id: row.id, title: seed.title, format: row.format, hook: seed.hook, beats: shapeBeats(seed.beats, pref.length_pref, seed.shortKeep), length: pref.length_pref ?? 'medium', sources: seed.sources, why, sourceCheck: seed.checked ? 'manual' : 'pending', checked: seed.checked ?? null }, readToday: s.last_read_day === day });
});

app.post('/api/read', async (c) => {
  const b = await c.req.json<{ holeId: string; seconds: number; completed: boolean }>();
  const { u, s, sub } = await loadAll(c);
  if (!accessOf(u, sub).rabbitHoles) return c.json({ error: 'paywall', message: 'Your 3-day trial has ended.' }, 402);
  const hole = await c.env.DB.prepare('SELECT id,topic_id,format,day FROM rabbit_holes WHERE id=? AND user_id=?').bind(b.holeId, u.id).first<any>();
  if (!hole) return c.json({ error: 'not found' }, 404);
  const seed = SEED.find((t) => t.id === hole.topic_id)!; const day = localDay(new Date(), u.timezone);
  const seconds = Math.max(0, Math.min(3600, Math.floor(b.seconds || 0)));
  await c.env.DB.prepare('INSERT INTO read_events (id,user_id,hole_id,topic_tags,format,seconds_read,completed,day,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(rid(), u.id, hole.id, JSON.stringify(seed.tags), hole.format, seconds, b.completed ? 1 : 0, day, Date.now()).run();
  if (!b.completed) return c.json({ ok: true });
  // only today's hole can extend today's streak; re-reading an old one cannot farm streak days
  if (hole.day !== day) return c.json({ ok: true, alreadyCounted: true });
  const prev: StreakState = { current: s.current, longest: s.longest, lastReadDay: s.last_read_day, freezesLeft: s.freezes_left };
  const r = recordRead(prev, day);
  let bonus = 0;
  if (!r.alreadyCounted && Math.random() < bonusChance(c.env.BONUS_CHANCE)) bonus = 1;
  // compare-and-set on the previous last_read_day: of two concurrent completions only one updates the streak
  const upd = await c.env.DB.prepare('UPDATE streaks SET current=?,longest=?,last_read_day=?,freezes_left=?,bonus_holes=bonus_holes+? WHERE user_id=? AND last_read_day IS ?')
    .bind(r.state.current, r.state.longest, r.state.lastReadDay, r.state.freezesLeft, bonus, u.id, s.last_read_day).run();
  if (!upd.meta.changes && !r.alreadyCounted) return c.json({ ok: true, alreadyCounted: true });
  return c.json({ ok: true, streak: r.state.current, freezesUsed: r.freezesUsed, reset: r.reset, alreadyCounted: r.alreadyCounted, bonusEarned: bonus === 1 });
});


// Redeem one earned bonus hole: an extra story on a topic not yet seen. Never extends the streak (only today's main hole does).
app.post('/api/bonus/redeem', async (c) => {
  const { u, sub, pref } = await loadAll(c);
  if (!pref) return c.json({ error: 'onboarding' }, 409);
  if (!accessOf(u, sub).rabbitHoles) return c.json({ error: 'paywall', message: 'Your 3-day trial has ended.' }, 402);
  const day = localDay(new Date(), u.timezone);
  const seen = ((await c.env.DB.prepare('SELECT topic_id FROM rabbit_holes WHERE user_id=?').bind(u.id).all()).results as any[]).map((r) => r.topic_id);
  const profile = { interestTags: JSON.parse(pref.interest_tags), formats: JSON.parse(pref.formats) };
  const pick = pickTopic(SEED.map((t) => ({ id: t.id, tags: t.tags, formats: FORMATS.map((f) => f.id) })), seen, await recentEvents(c, u.id), profile);
  if (!pick) return c.json({ error: 'no_new_content', message: 'You have seen every story we have for now. Your bonus is kept.' }, 409);
  // atomic spend: only succeeds while a bonus is left, so two taps cannot spend one bonus twice
  const spend = await c.env.DB.prepare('UPDATE streaks SET bonus_holes=bonus_holes-1 WHERE user_id=? AND bonus_holes>0').bind(u.id).run();
  if (!spend.meta.changes) return c.json({ error: 'no_bonus', message: 'No bonus rabbit holes to open.' }, 409);
  const seed = SEED.find((t) => t.id === pick.topic.id)!; const id = rid();
  await c.env.DB.prepare('INSERT INTO rabbit_holes (id,user_id,day,topic_id,format,title,body,sources,verified) VALUES (?,?,?,?,?,?,?,?,0)')
    .bind(id, u.id, `${day}#bonus-${id.slice(0, 6)}`, seed.id, pick.format, seed.title, JSON.stringify({ hook: seed.hook, beats: seed.beats }), JSON.stringify(seed.sources)).run();
  return c.json({ hole: { id, title: seed.title, format: pick.format, hook: seed.hook, beats: shapeBeats(seed.beats, pref.length_pref, seed.shortKeep), length: pref.length_pref ?? 'medium', sources: seed.sources, why: 'A bonus rabbit hole you earned.', sourceCheck: seed.checked ? 'manual' : 'pending', checked: seed.checked ?? null, bonus: true } });
});

app.post('/api/finder', async (c) => {
  const { u, sub } = await loadAll(c);
  const access = accessOf(u, sub);
  const b = await c.req.json<{ a: string; b: string }>();
  if (!b.a?.trim() || !b.b?.trim()) return c.json({ error: 'Type two words.' }, 400);
  const since = Date.now() - (access.finderQuota?.period === 'week' ? 7 : 1) * 86400000; // rolling window; calendar-based reset is undecided
  const used = await c.env.DB.prepare('SELECT count(*) n FROM finder_uses WHERE user_id=? AND created_at>?').bind(u.id, since).first<{ n: number }>();
  if (!finderUsesAllowed(access.finderQuota, used?.n ?? 0)) return c.json({ error: 'quota', message: 'No Connection Finder tries left for now.' }, 429);
  // No generator is connected yet. Never invent a connection; do not consume quota.
  return c.json({ error: 'generator_not_connected', message: 'The Connection Finder needs the fact engine, which is not switched on yet.' }, 503);
});

app.post('/api/invite', async (c) => {
  const code = rid().slice(0, 8); await c.env.DB.prepare('INSERT INTO invites (code,inviter_id,created_at) VALUES (?,?,?)').bind(code, c.get('uid'), Date.now()).run();
  return c.json({ code });
});
app.post('/api/join', async (c) => {
  const { code } = await c.req.json<{ code: string }>(); const uid = c.get('uid');
  const inv = await c.env.DB.prepare('SELECT inviter_id FROM invites WHERE code=?').bind((code || '').trim()).first<{ inviter_id: string }>();
  if (!inv || inv.inviter_id === uid) return c.json({ error: 'That invite code did not work.' }, 400);
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT OR IGNORE INTO friendships (user_id,friend_id,created_at) VALUES (?,?,?)').bind(uid, inv.inviter_id, now),
    c.env.DB.prepare('INSERT OR IGNORE INTO friendships (user_id,friend_id,created_at) VALUES (?,?,?)').bind(inv.inviter_id, uid, now),
  ]);
  return c.json({ ok: true });
});
app.get('/api/leaderboard', async (c) => {
  const uid = c.get('uid'); const me = await c.env.DB.prepare('SELECT timezone FROM users WHERE id=?').bind(uid).first<any>();
  const rows = (await c.env.DB.prepare(`SELECT u.id, COALESCE(u.display_name, substr(u.email,1,instr(u.email,'@')-1)) name, s.current, s.last_read_day, s.freezes_left, u.timezone FROM users u JOIN streaks s ON s.user_id=u.id WHERE u.id=? OR u.id IN (SELECT friend_id FROM friendships WHERE user_id=?)`).bind(uid, uid).all()).results as any[];
  const out = rows.map((r) => ({ name: r.name, me: r.id === uid, streak: displayStreak({ current: r.current, longest: 0, lastReadDay: r.last_read_day, freezesLeft: r.freezes_left }, localDay(new Date(), r.timezone || me.timezone)) }))
    .sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name));
  return c.json({ board: out });
});

// Billing: not live. Checkout is not wired; the webhook endpoint verifies signatures and logs events only.
app.post('/api/checkout', async (c) => {
  const b = await c.req.json<{ plan: string }>().catch(() => ({ plan: '' }));
  const r = await createCheckout(c.env, { id: c.get('uid') }, b.plan);
  return r.ok ? c.json({ url: r.url }) : c.json({ error: r.error, message: r.message }, r.status as any);
});
app.post('/api/webhooks/dodo', async (c) => {
  const secret = c.env.DODO_WEBHOOK_SECRET; if (!secret) return c.json({ error: 'not configured' }, 501);
  const body = await c.req.text();
  const ok = await verifyWebhook(secret, { id: c.req.header('webhook-id') || '', timestamp: c.req.header('webhook-timestamp') || '', signature: c.req.header('webhook-signature') || '' }, body);
  if (!ok) return c.json({ error: 'bad signature' }, 401);
  let ev: any; try { ev = JSON.parse(body); } catch { return c.json({ error: 'bad json' }, 400); }
  const id = c.req.header('webhook-id')!;
  const ins = await c.env.DB.prepare('INSERT OR IGNORE INTO webhook_events (id,type,received_at) VALUES (?,?,?)').bind(id, String(ev.type ?? 'unknown'), Date.now()).run();
  if (!ins.meta.changes) return c.json({ ok: true, duplicate: true });
  let pm = {}; try { pm = JSON.parse(c.env.DODO_PRODUCT_MAP || '{}'); } catch { /* ignore bad config */ }
  const u = mapSubscriptionEvent(ev, pm);
  if (u) {
    const exists = await c.env.DB.prepare('SELECT id FROM users WHERE id=?').bind(u.userId).first();
    if (exists) await c.env.DB.prepare('INSERT INTO subscriptions (user_id,plan,status,dodo_subscription_id,paid_through,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,dodo_subscription_id=excluded.dodo_subscription_id,paid_through=excluded.paid_through,updated_at=excluded.updated_at').bind(u.userId, u.plan, u.status, u.dodoSubscriptionId, u.paidThrough, Date.now()).run();
  }
  return c.json({ ok: true });
});

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));
export default app;
