import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { SEED, TOPIC_TAGS, FORMATS, WHY_READ, COUNTRIES, COUNTRIES_WITH_STORIES } from '../content/seed';
import { PLANS } from '../shared/config';
import { accessFor, finderUsesAllowed, type Account } from '../shared/entitlements';
import { recordRead, displayStreak, dayDiff, localDay, type StreakState } from '../shared/streak';
import { pickTopic, type ReadEvent } from '../shared/recommend';
import { verifyWebhook } from './webhook';
import { mapSubscriptionEvent } from './billing';
import { createToken, consumeToken } from './authtokens';
import { getMailer } from './mail';
import { createCheckout } from './checkout';
import { findBridge } from './bridge';
import { judge } from './judge';
import { shapeBeats } from '../shared/shape';

type Env = { DB: D1Database; ASSETS: Fetcher; DODO_WEBHOOK_SECRET?: string; DODO_PRODUCT_MAP?: string; BONUS_CHANCE?: string; DODO_API_KEY?: string; MAIL_ENABLED?: string; REQUIRE_VERIFIED_EMAIL?: string; IP_SIGNUP_MAX?: string; DODO_ENV?: string; AI?: any; AI_ENABLED?: string; AI_PLAN_CONFIRMED?: string; FINDER_MODEL?: string; APP_URL?: string; CHECKOUT_ENABLED?: string };
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
  if (['/api/signup', '/api/login', '/api/config', '/api/webhooks/dodo', '/api/password/forgot', '/api/password/reset', '/api/email/verify'].includes(p)) return next();
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

app.get('/api/config', (c) => c.json({ topics: TOPIC_TAGS, formats: FORMATS, whyRead: WHY_READ, countries: COUNTRIES, countriesWithStories: COUNTRIES_WITH_STORIES(), plans: PLANS, finderGenerator: false, emailRecovery: !!getMailer(c.env), payments: c.env.CHECKOUT_ENABLED === 'true' && c.env.DODO_API_KEY && c.env.DODO_ENV !== 'live_mode' ? 'test_mode' : 'not_configured' }));

// Per-IP throttle (security, not a product rule). The IP is stored only as a truncated SHA-256 in login_attempts.
async function ipKey(c: any, action: string) {
  const ip = c.req.header('cf-connecting-ip') || 'local';
  const h = await crypto.subtle.digest('SHA-256', enc.encode('ip:' + ip));
  return `i:${action}:${hex(h).slice(0, 24)}`;
}
async function ipLimited(c: any, action: string, max: number, windowMs: number, record: boolean) {
  if (!c.req.header('cf-connecting-ip')) return false; // local dev has no client IP; Cloudflare always sets it in production
  const key = await ipKey(c, action); const since = Date.now() - windowMs;
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key=? AND at>?').bind(key, since).first();
  if ((n?.n ?? 0) >= max) return true;
  if (record) await c.env.DB.prepare('INSERT INTO login_attempts (key,at) VALUES (?,?)').bind(key, Date.now()).run();
  return false;
}
const verifiedGate = async (c: any, next: any) => {
  if (c.env.REQUIRE_VERIFIED_EMAIL === 'true') {
    const u = await c.env.DB.prepare('SELECT email_verified_at v FROM users WHERE id=?').bind(c.get('uid')).first();
    if (!u?.v) return c.json({ error: 'verify_email', message: 'Please verify your email first.' }, 403);
  }
  await next();
};

app.post('/api/signup', async (c) => {
  if (await ipLimited(c, 'signup', Number(c.env.IP_SIGNUP_MAX) || 10, 3600000, true)) return c.json({ error: 'Too many sign-ups from here. Please try again later.' }, 429);
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
  if (await ipLimited(c, 'login', 30, 15 * 60000, false)) return c.json({ error: 'Too many tries. Please wait a few minutes.' }, 429);
  const b = await c.req.json<{ email: string; password: string }>();
  const email = String(b.email || '').trim().toLowerCase().slice(0, 254);
  // throttle: max 8 failed attempts per email per 15 min (also bounds password guessing)
  const key = 'e:' + email; const since = Date.now() - 15 * 60000;
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key=? AND at>?').bind(key, since).first<{ n: number }>();
  if ((n?.n ?? 0) >= 8) return c.json({ error: 'Too many tries. Please wait a few minutes.' }, 429);
  const u = await c.env.DB.prepare('SELECT id,pw_hash,pw_salt FROM users WHERE email=?').bind(email).first<any>();
  const good = u ? ctEq(await hashPw(String(b.password || ''), u.pw_salt), u.pw_hash) : (await hashPw(String(b.password || ''), 'x'), false);
  if (!good) { await c.env.DB.prepare('INSERT INTO login_attempts (key,at) VALUES (?,?)').bind(key, Date.now()).run(); await c.env.DB.prepare('INSERT INTO login_attempts (key,at) VALUES (?,?)').bind(await ipKey(c, 'login'), Date.now()).run(); return c.json({ error: 'Email or password did not match. If you have not signed up yet, tap "I need an account".' }, 401); }
  await c.env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
  await startSession(c, u.id);
  return c.json({ ok: true });
});
// Account recovery. Sending needs a mail provider, which is not connected: forgot answers 501 honestly instead of pretending.
app.post('/api/password/forgot', async (c) => {
  const mailer = getMailer(c.env);
  if (mailer && (await ipLimited(c, 'forgot', 10, 3600000, true))) return c.json({ ok: true, message: 'If that email has an account, a reset link is on its way.' });
  if (!mailer) return c.json({ error: 'recovery_unavailable', message: 'Password reset by email is not available yet in this preview.' }, 501);
  const b = await c.req.json<{ email: string }>();
  const email = String(b.email || '').trim().toLowerCase().slice(0, 254);
  const key = 'r:' + email; const since = Date.now() - 60 * 60000;
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key=? AND at>?').bind(key, since).first<{ n: number }>();
  const generic = c.json({ ok: true, message: 'If that email has an account, a reset link is on its way.' });
  if ((n?.n ?? 0) >= 3) return generic; // silent: no signal about the account
  await c.env.DB.prepare('INSERT INTO login_attempts (key,at) VALUES (?,?)').bind(key, Date.now()).run();
  const u = await c.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first<{ id: string }>();
  if (u) { const t = await createToken(c.env.DB, u.id, 'reset'); await mailer.send(email, 'Reset your password', `Open this link within 1 hour: ${new URL(c.req.url).origin}/?reset=${t}`); }
  return generic;
});
app.post('/api/password/reset', async (c) => {
  if (await ipLimited(c, 'reset', 20, 3600000, true)) return c.json({ error: 'Too many tries. Please wait.' }, 429);
  const b = await c.req.json<{ token: string; password: string }>();
  if (String(b.password || '').length < 8) return c.json({ error: 'Use a password of 8+ characters.' }, 400);
  const uid = await consumeToken(c.env.DB, String(b.token || ''), 'reset');
  if (!uid) return c.json({ error: 'That reset link is invalid or has expired.' }, 400);
  const salt = rid();
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET pw_hash=?, pw_salt=? WHERE id=?').bind(await hashPw(b.password, salt), salt, uid),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(uid), // everyone is logged out
    c.env.DB.prepare('DELETE FROM login_attempts WHERE key IN (SELECT \'e:\' || email FROM users WHERE id=?)').bind(uid),
  ]);
  return c.json({ ok: true });
});
app.post('/api/email/verify', async (c) => {
  const b = await c.req.json<{ token: string }>();
  const uid = await consumeToken(c.env.DB, String(b.token || ''), 'verify');
  if (!uid) return c.json({ error: 'That link is invalid or has expired.' }, 400);
  await c.env.DB.prepare('UPDATE users SET email_verified_at=COALESCE(email_verified_at,?) WHERE id=?').bind(Date.now(), uid).run();
  return c.json({ ok: true });
});

app.post('/api/logout', async (c) => { const sid = getCookie(c, 'sid'); if (sid) await c.env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run(); deleteCookie(c, 'sid', { path: '/' }); return c.json({ ok: true }); });

// Country is a starting point: for a reader's first few holes, prefer unseen local stories that also match an interest; otherwise the normal pool.
const STOP = new Set('why how the and for are you our out too but not can all any get got its was who did does way ways make made lot lots about with that this what from have been into your they them when where which would could should there their because really just like know want learn more some very much many also than then'.split(' '));
function curiousWords(text: string): string[] { return [...new Set((text.toLowerCase().match(/[a-z]{3,}/g) || []).filter((w) => !STOP.has(w)))].slice(0, 12); }
// Soft hints only. Country, interests, the "why" answer and free text each narrow the pool for a reader's first few holes; none is treated as fact and none is a restriction.
// Returns the narrowed pool plus a plain reason string, or null reason for the normal pool.
function poolFor(pref: any, seen: string[]): { pool: typeof SEED; reason: string | null } {
  let qa: any = {}; try { qa = JSON.parse(pref?.quiz_answers || '{}'); } catch { /* ignore */ }
  const unseen = SEED.filter((t) => !seen.includes(t.id));
  if (seen.length >= 3) return { pool: SEED, reason: null };
  const interests: string[] = JSON.parse(pref?.interest_tags || '[]');
  if ((qa.why || []).includes('understand')) interests.push('everyday life', 'places');
  // 2. words from the free-text note that literally appear in a story's title, tags or text
  const words = curiousWords(String(qa.curious || ''));
  if (words.length) {
    const scored = unseen.map((t) => {
      const head = new Set((t.title + ' ' + t.tags.join(' ')).toLowerCase().match(/[a-z]{3,}/g) || []); const body = new Set(t.story.join(' ').toLowerCase().match(/[a-z]{3,}/g) || []);
      const hit = words.filter((w) => head.has(w) || body.has(w)); const score = words.reduce((n, w) => n + (head.has(w) ? 3 : body.has(w) ? 1 : 0), 0);
      return { t, hit: hit.sort((x, y) => Number(head.has(y)) - Number(head.has(x))), score };
    }).filter((x) => x.hit.length);
    if (scored.length) { const m = Math.max(...scored.map((x) => x.score)); const top = scored.filter((x) => x.score === m); return { pool: top.map((x) => x.t), reason: `You mentioned "${top[0].hit[0]}" in your note, and this story uses that word. That is a word match only.` }; }
  }
  // 3. country as a starting point
  if (qa.country) {
    const local = SEED.filter((t) => t.countries?.includes(qa.country) && t.tags.some((g) => interests.includes(g)));
    if (local.length) return { pool: local, reason: null };
  }
  return { pool: SEED, reason: null };
}
// Estimate only: words / 200 per minute, rounded up.
const readMinutes = (paras: string[]) => Math.max(1, Math.ceil(paras.join(' ').split(/\s+/).filter(Boolean).length / 200));
async function loadAll(c: any) {
  const uid = c.get('uid');
  const u = await c.env.DB.prepare('SELECT id,email,display_name,timezone,signup_at,onboarded_at FROM users WHERE id=?').bind(uid).first();
  const s = await c.env.DB.prepare('SELECT current,longest,last_read_day,freezes_left,bonus_holes FROM streaks WHERE user_id=?').bind(uid).first();
  const sub = await c.env.DB.prepare('SELECT plan,status,paid_through FROM subscriptions WHERE user_id=?').bind(uid).first();
  const pref = await c.env.DB.prepare('SELECT interest_tags,formats,length_pref,quiz_answers FROM preferences WHERE user_id=?').bind(uid).first();
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
    prefs: pref ? { quiz: (() => { try { const q = JSON.parse(pref.quiz_answers || '{}'); return { country: q.country ?? null, why: q.why ?? [], curious: q.curious ?? '' }; } catch { return { country: null, why: [], curious: '' }; } })(), interestTags: JSON.parse(pref.interest_tags), formats: JSON.parse(pref.formats), length: pref.length_pref } : null,
  });
});

app.post('/api/quiz', async (c) => {
  const b = await c.req.json<{ interestTags: string[]; formats: string[]; length?: string; country?: string; why?: string[]; curious?: string }>();
  const tags = (b.interestTags || []).filter((t) => TOPIC_TAGS.includes(t)); const fmts = (b.formats || []).filter((f) => FORMATS.some((x) => x.id === f));
  if (!tags.length || !fmts.length) return c.json({ error: 'Pick at least one topic and one style.' }, 400);
  // Only validated fields are stored. Country is optional and is a starting point for topic order, never a restriction.
  const country = COUNTRIES.some((x) => x.code === b.country) ? b.country : null;
  const why = (b.why || []).filter((w) => WHY_READ.some((x) => x.id === w));
  const curious = String(b.curious || '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;
  const length = ['short', 'medium'].includes(String(b.length)) ? b.length : null;
  const uid = c.get('uid');
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT OR REPLACE INTO preferences (user_id,interest_tags,formats,length_pref,quiz_answers) VALUES (?,?,?,?,?)').bind(uid, JSON.stringify(tags), JSON.stringify(fmts), length, JSON.stringify({ interestTags: tags, formats: fmts, length, country, why, curious })),
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
  let row = await c.env.DB.prepare('SELECT id,topic_id,format,title,body FROM rabbit_holes WHERE user_id=? AND day=?').bind(u.id, day).first<any>();
  let why = '';
  let pickReason: string | null = null;
  const profile = { interestTags: JSON.parse(pref.interest_tags), formats: JSON.parse(pref.formats) };
  if (!row) {
    const seen = ((await c.env.DB.prepare('SELECT topic_id FROM rabbit_holes WHERE user_id=? ORDER BY day').bind(u.id).all()).results as any[]).map((r) => r.topic_id);
    const events = await recentEvents(c, u.id);
    const n = seen.length;
    const pf = poolFor(pref, seen); pickReason = pf.reason;
    let pick = pickTopic(pf.pool.map((t) => ({ id: t.id, tags: t.tags, formats: FORMATS.map((f) => f.id) })), seen, events, profile, n > 0 && n % 4 === 3) ?? pickTopic(SEED.map((t) => ({ id: t.id, tags: t.tags, formats: FORMATS.map((f) => f.id) })), seen, events, profile, n > 0 && n % 4 === 3);
    if (!pick) pick = pickTopic(SEED.map((t) => ({ id: t.id, tags: t.tags, formats: FORMATS.map((f) => f.id) })), [], events, profile);
    if (!pick) return c.json({ error: 'no content' }, 500);
    const seed = SEED.find((t) => t.id === pick.topic.id)!;
    const id = rid();
    // UNIQUE(user_id,day) makes concurrent first opens safe: the loser re-reads the winner's row.
    await c.env.DB.prepare('INSERT OR IGNORE INTO rabbit_holes (id,user_id,day,topic_id,format,title,body,sources,verified) VALUES (?,?,?,?,?,?,?,?,0)')
      .bind(id, u.id, day, seed.id, pick.format, seed.title, JSON.stringify({ hook: seed.hook, beats: seed.beats, reason: pf.pool.some((t) => t.id === seed.id) ? pf.reason : null }), JSON.stringify(seed.sources)).run();
    row = await c.env.DB.prepare('SELECT id,topic_id,format,title,body FROM rabbit_holes WHERE user_id=? AND day=?').bind(u.id, day).first<any>();
  }
  const seed = SEED.find((t) => t.id === row.topic_id)!;
  const matched = seed.tags.filter((t) => profile.interestTags.includes(t));
  let reason: string | null = null; try { reason = JSON.parse(row.body || '{}').reason ?? null; } catch { /* ignore */ }
  let whyModes: string[] = []; try { whyModes = JSON.parse(pref.quiz_answers || '{}').why ?? []; } catch { /* ignore */ }
  why = matched.length ? `Because you like ${matched.join(' and ')}.` : 'A fresh corner to explore, to keep things from getting samey.';
  if (reason) why = reason;
  return c.json({ hole: { id: row.id, title: seed.title, format: row.format, hook: seed.hook, story: pref.length_pref === 'short' ? seed.story.slice(0, 2) : seed.story, beats: seed.beats, length: pref.length_pref ?? 'medium', sources: seed.sources, why, whyModes, topicId: seed.id, tags: seed.tags, minutes: readMinutes(pref.length_pref === 'short' ? seed.story.slice(0, 2) : seed.story), saved: !!(await c.env.DB.prepare('SELECT 1 x FROM saved WHERE user_id=? AND topic_id=?').bind(u.id, seed.id).first()), related: seed.related ? (() => { const r = SEED.find((x) => x.id === seed.related!.id); return r ? { id: r.id, title: r.title, sentence: seed.related!.sentence, page: seed.related!.page } : null; })() : null, shortened: pref.length_pref === 'short' && seed.story.length > 2, sourceCheck: seed.checked ? 'manual' : 'pending', checked: seed.checked ?? null }, readToday: s.last_read_day === day });
});

// Optional, reader-chosen: open the story that today's story points to. Read-only: no streak, read event, or "seen" change.
app.get('/api/related/:id', async (c) => {
  const { u, s, sub } = await loadAll(c);
  if (!accessOf(u, sub).rabbitHoles) return c.json({ error: 'paywall', message: 'Your 3-day trial has ended.' }, 402);
  const day = localDay(new Date(), u.timezone);
  const row = await c.env.DB.prepare('SELECT topic_id FROM rabbit_holes WHERE user_id=? AND day=?').bind(u.id, day).first<any>();
  const cur = row && SEED.find((t) => t.id === row.topic_id);
  if (!cur?.related || cur.related.id !== c.req.param('id')) return c.json({ error: 'not found' }, 404);
  const t = SEED.find((x) => x.id === cur.related!.id)!;
  return c.json({ hole: { id: t.id, title: t.title, story: t.story, beats: t.beats, format: 'narrative', sources: t.sources, hook: t.hook, whyModes: [], sourceCheck: t.checked ? 'manual' : 'pending', checked: t.checked ?? null } });
});

// ---- Saved discoveries, learning history, and reading a story you have already met (read-only; no streak or read events) ----
async function canOpen(c: any, uid: string, topicId: string, tz: string) {
  if (await c.env.DB.prepare('SELECT 1 x FROM rabbit_holes WHERE user_id=? AND topic_id=?').bind(uid, topicId).first()) return true;
  const day = localDay(new Date(), tz);
  const row: any = await c.env.DB.prepare('SELECT topic_id FROM rabbit_holes WHERE user_id=? AND day=?').bind(uid, day).first();
  const cur = row && SEED.find((t) => t.id === row.topic_id);
  return !!cur?.related && cur.related.id === topicId;
}
app.get('/api/history', async (c) => {
  const { u } = await loadAll(c);
  const r = await c.env.DB.prepare('SELECT rh.day, rh.topic_id, EXISTS(SELECT 1 FROM read_events re WHERE re.hole_id=rh.id AND re.completed=1) AS done FROM rabbit_holes rh WHERE rh.user_id=? ORDER BY rh.day DESC LIMIT 60').bind(u.id).all();
  const items = (r.results as any[]).map((x) => { const t = SEED.find((s) => s.id === x.topic_id); return t ? { day: x.day, topicId: t.id, title: t.title, tags: t.tags, done: !!x.done } : null; }).filter(Boolean);
  const ev: any = await c.env.DB.prepare('SELECT COUNT(*) n, COALESCE(SUM(completed),0) done, COALESCE(SUM(seconds_read),0) secs FROM read_events WHERE user_id=?').bind(u.id).first();
  return c.json({ items, recorded: { reads: ev?.n ?? 0, completed: ev?.done ?? 0, seconds: ev?.secs ?? 0 } });
});
app.get('/api/calendar', async (c) => {
  const { u, s } = await loadAll(c);
  const today = localDay(new Date(), u.timezone);
  const r = await c.env.DB.prepare('SELECT DISTINCT day FROM read_events WHERE user_id=? AND completed=1 ORDER BY day DESC LIMIT 400').bind(u.id).all();
  const read = (r.results as any[]).map((x) => x.day as string);
  // Freeze days are not stored. Inside the current streak run, a gap between two completed days is a day a freeze covered (that is the only way the run can continue). Earlier gaps are left unmarked.
  const run = displayStreak({ current: s.current, longest: s.longest, lastReadDay: s.last_read_day, freezesLeft: s.freezes_left }, today) > 0 ? read.slice(0, s.current) : [];
  const freeze: string[] = [];
  for (let i = 0; i + 1 < run.length; i++) { const gap = dayDiff(run[i + 1], run[i]); for (let g = 1; g < gap; g++) { const d = new Date(Date.UTC(+run[i + 1].slice(0, 4), +run[i + 1].slice(5, 7) - 1, +run[i + 1].slice(8, 10) + g)); freeze.push(d.toISOString().slice(0, 10)); } }
  return c.json({ today, read, freeze });
});
app.get('/api/saved', async (c) => {
  const { u } = await loadAll(c);
  const r = await c.env.DB.prepare('SELECT topic_id, created_at FROM saved WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(u.id).all();
  return c.json({ items: (r.results as any[]).map((x) => { const t = SEED.find((s) => s.id === x.topic_id); return t ? { topicId: t.id, title: t.title, hook: t.hook, tags: t.tags } : null; }).filter(Boolean) });
});
app.post('/api/save', async (c) => {
  const b = await c.req.json<{ topicId: string; saved: boolean }>();
  const { u } = await loadAll(c);
  if (!SEED.some((t) => t.id === b.topicId) || !(await canOpen(c, u.id, b.topicId, u.timezone))) return c.json({ error: 'not found' }, 404);
  if (b.saved) await c.env.DB.prepare('INSERT OR IGNORE INTO saved (user_id,topic_id,created_at) VALUES (?,?,?)').bind(u.id, b.topicId, Date.now()).run();
  else await c.env.DB.prepare('DELETE FROM saved WHERE user_id=? AND topic_id=?').bind(u.id, b.topicId).run();
  return c.json({ ok: true, saved: !!b.saved });
});
app.get('/api/story/:id', async (c) => {
  const { u, sub, pref } = await loadAll(c);
  if (!accessOf(u, sub).rabbitHoles) return c.json({ error: 'paywall', message: 'Your 3-day trial has ended.' }, 402);
  const t = SEED.find((x) => x.id === c.req.param('id'));
  if (!t || !(await canOpen(c, u.id, t.id, u.timezone))) return c.json({ error: 'not found' }, 404);
  const saved = !!(await c.env.DB.prepare('SELECT 1 x FROM saved WHERE user_id=? AND topic_id=?').bind(u.id, t.id).first());
  return c.json({ hole: { id: t.id, topicId: t.id, title: t.title, story: pref?.length_pref === 'short' ? t.story.slice(0, 2) : t.story, beats: t.beats, format: 'narrative', sources: t.sources, hook: t.hook, tags: t.tags, minutes: readMinutes(t.story), saved, whyModes: [], sourceCheck: t.checked ? 'manual' : 'pending', checked: t.checked ?? null } });
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
  const seen = ((await c.env.DB.prepare('SELECT topic_id FROM rabbit_holes WHERE user_id=? ORDER BY day').bind(u.id).all()).results as any[]).map((r) => r.topic_id);
  const profile = { interestTags: JSON.parse(pref.interest_tags), formats: JSON.parse(pref.formats) };
  const pick = pickTopic(SEED.map((t) => ({ id: t.id, tags: t.tags, formats: FORMATS.map((f) => f.id) })), seen, await recentEvents(c, u.id), profile);
  if (!pick) return c.json({ error: 'no_new_content', message: 'You have seen every story we have for now. Your bonus is kept.' }, 409);
  // atomic spend: only succeeds while a bonus is left, so two taps cannot spend one bonus twice
  const spend = await c.env.DB.prepare('UPDATE streaks SET bonus_holes=bonus_holes-1 WHERE user_id=? AND bonus_holes>0').bind(u.id).run();
  if (!spend.meta.changes) return c.json({ error: 'no_bonus', message: 'No bonus rabbit holes to open.' }, 409);
  const seed = SEED.find((t) => t.id === pick.topic.id)!; const id = rid();
  await c.env.DB.prepare('INSERT INTO rabbit_holes (id,user_id,day,topic_id,format,title,body,sources,verified) VALUES (?,?,?,?,?,?,?,?,0)')
    .bind(id, u.id, `${day}#bonus-${id.slice(0, 6)}`, seed.id, pick.format, seed.title, JSON.stringify({ hook: seed.hook, beats: seed.beats }), JSON.stringify(seed.sources)).run();
  return c.json({ hole: { id, title: seed.title, format: pick.format, hook: seed.hook, story: pref.length_pref === 'short' ? seed.story.slice(0, 2) : seed.story, beats: seed.beats, length: pref.length_pref ?? 'medium', sources: seed.sources, why: 'A bonus rabbit hole you earned.', shortened: pref.length_pref === 'short' && seed.story.length > 2, sourceCheck: seed.checked ? 'manual' : 'pending', checked: seed.checked ?? null, bonus: true } });
});

app.post('/api/finder', async (c) => {
  const { u, sub } = await loadAll(c);
  const access = accessOf(u, sub);
  const b = await c.req.json<{ a: string; b: string }>();
  if (!b.a?.trim() || !b.b?.trim()) return c.json({ error: 'Type two words.' }, 400);
  const since = Date.now() - (access.finderQuota?.period === 'week' ? 7 : 1) * 86400000; // rolling window; calendar-based reset is undecided
  const used = await c.env.DB.prepare('SELECT count(*) n FROM finder_uses WHERE user_id=? AND created_at>?').bind(u.id, since).first<{ n: number }>();
  if (!finderUsesAllowed(access.finderQuota, used?.n ?? 0)) return c.json({ error: 'quota', message: 'No Connection Finder tries left for now.' }, 429);
  if (await ipLimited(c, 'finder', 120, 3600000, true)) return c.json({ error: 'slow_down', message: 'Slow down a little and try again later.' }, 429);
  const res = await findBridge(c.env as any, b.a, b.b);
  if (res.ok || res.reason === 'no_bridge') await c.env.DB.prepare('INSERT INTO finder_uses (id,user_id,word_a,word_b,result,sources,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(rid(), u.id, b.a.slice(0, 40), b.b.slice(0, 40), res.ok ? res.bridge.via : null, res.ok ? JSON.stringify([res.a.url, res.b.url]) : null, Date.now()).run().catch(() => {});
  if (res.ok) return c.json({ ok: true, a: res.a, b: res.b, bridge: res.bridge, inference: res.inference, alternatives: res.alternatives });
  return c.json({ ok: false, reason: res.reason, message: res.message }, res.reason === 'ai_unavailable' ? 503 : 200);
});

app.post('/api/invite', verifiedGate, async (c) => {
  const code = rid().slice(0, 8); await c.env.DB.prepare('INSERT INTO invites (code,inviter_id,created_at) VALUES (?,?,?)').bind(code, c.get('uid'), Date.now()).run();
  return c.json({ code });
});
app.post('/api/join', verifiedGate, async (c) => {
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
app.post('/api/checkout', verifiedGate, async (c) => {
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
