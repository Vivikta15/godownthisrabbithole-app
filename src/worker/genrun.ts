// Autonomous generator runtime: resumable ticks (Workers Free allows 50 subrequests per invocation), D1 replay cache, fail-closed.
// Nothing here runs unless GEN_ENABLED === 'true' and a key secret exists. Every model call goes through callModel (hard cap ledger).
import { PROMPTS, runCandidate, LABEL, type Runners, type Candidate } from '../gen/pipeline';
import { acquireSources } from '../gen/source';
import { TOPICS, topicAllowed } from '../gen/topics';
import { decide, canaryOk, type Health } from '../gen/controller';
import { callModel, spentMicro, WORKING_CAP_MICRO, dayStartMs, type GenEnv } from './genspend';
import { JUDGE_SYSTEM } from './judge';
import { SEED, type Seed } from '../content/seed';
import CANARY from '../gen/canary.json';

export const WRITER = 'claude-haiku-5-5', JUDGE = 'claude-sonnet-5';
export const MAX_EXTERNAL_PER_TICK = 8, MAX_TICKS_PER_ATTEMPT = 40, MAX_ATTEMPTS_PER_DAY = 4, TARGET_POOL = 30, LOW_WATER = 5, MIN_GAP_MS = 20 * 60_000, LEASE_MS = 4 * 60_000;
class Yield extends Error {}
type Cur = { id: string; kind: 'attempt' | 'canary'; topic?: string; tags?: string[]; countries?: string[]; ticks: number; micro: number; calls?: number; started: number };
type Ctx = { env: GenEnv; fetchFn: typeof fetch; cache: Map<string, string>; used: number; max: number; yielded: boolean; stop: string | null; micro: number; calls: number; diag: string[]; attemptId: string; kind: string };

const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
async function getC(db: D1Database, k: string): Promise<string | null> { const r = await db.prepare('SELECT v FROM gen_control WHERE k=?').bind(k).first<{ v: string }>(); return r ? r.v : null; }
async function setC(db: D1Database, k: string, v: string, now = Date.now()) { await db.prepare('INSERT INTO gen_control (k,v,updated_at) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at').bind(k, v, now).run(); }

async function cached(ctx: Ctx, key: string, fn: () => Promise<string>): Promise<string> {
  const hit = ctx.cache.get(key); if (hit !== undefined) return hit;
  if (ctx.used >= ctx.max) { ctx.yielded = true; throw new Yield(); }
  ctx.used++; const v = await fn(); ctx.cache.set(key, v);
  await ctx.env.DB.prepare('INSERT OR REPLACE INTO gen_cache (attempt,k,v) VALUES (?,?,?)').bind(ctx.attemptId, key, v).run(); return v;
}
function model(ctx: Ctx, stage: string, m: string, system: string, prompt: string, maxTokens: number): Promise<string> {
  const key = `m:${stage}:${fnv(m + '\u0000' + system + '\u0000' + prompt)}`;
  return cached(ctx, key, async () => {
    ctx.calls++;
    const r = await callModel(ctx.env, { model: m, system: system || undefined, prompt, maxTokens, id: `${ctx.attemptId}:${key}`, note: `${ctx.kind} ${stage}` }, ctx.fetchFn);
    if (!r.ok) { ctx.stop = r.reason; throw new Error(r.reason); }
    ctx.micro += r.micro; return r.text;
  });
}
// A fetch that replays from the cache. Responses are stored whole so a resumed tick sees exactly what the first tick saw.
function cachedFetch(ctx: Ctx): typeof fetch {
  return (async (input: any, init?: any) => {
    const url = String(input); const raw = await cached(ctx, 'f:' + url, async () => {
      try { const fx = ctx.fetchFn; const r = await fx(url, init); const ct = r.headers.get('content-type') || ''; const body = (await r.text()).slice(0, 600_000); ctx.diag.push(`${r.status} ${url.slice(8, 60)} ${body.length}`); return JSON.stringify({ ok: r.ok, url: r.url || url, ct, body }); }
      catch (e) { ctx.diag.push(`ERR ${url.slice(8, 60)} ${String(e).slice(0, 60)}`); return JSON.stringify({ ok: false, url, ct: '', body: '' }); }
    });
    const o = JSON.parse(raw);
    return { ok: o.ok, url: o.url, headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? o.ct : null) }, json: async () => JSON.parse(o.body), text: async () => o.body } as any;
  }) as any;
}
function runners(ctx: Ctx): Runners {
  return {
    note: (m: string) => { if (ctx.diag.length < 24) ctx.diag.push(m.slice(0, 500)); },
    extract: (title, text, known) => model(ctx, 'extract', WRITER, '', PROMPTS.extract(title, text, known), 1500),
    outline: (p) => model(ctx, 'outline', WRITER, '', p, 700), write: (p) => model(ctx, 'write', WRITER, '', p, 600),
    judge: (p) => model(ctx, 'judge', JUDGE, JUDGE_SYSTEM, p, 8), review: (p) => model(ctx, 'review', JUDGE, '', p, 300),
    reserve: () => true, // the real reservation happens inside callModel before every paid call
  };
}

const sentences = (p: string) => (p.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [p]).map((s) => s.trim());
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const hostLabel = (u: string, title: string) => { const h = new URL(u).hostname.replace(/^www\./, ''); return h.endsWith('wikipedia.org') ? `Wikipedia: ${title} (text under CC BY-SA 4.0)` : h; };
export const groupOf = (u: string) => { const h = new URL(u).hostname.replace(/^www\./, '').split('.'); return h.length >= 3 && ['co', 'ac', 'gov', 'org', 'com', 'edu', 'nic', 'net'].includes(h[h.length - 2]) ? h.slice(-3).join('.') : h.slice(-2).join('.'); };

// Turns an accepted candidate into the app's story shape. The hook and every answer are sentences that already passed the judge; the model only writes the questions.
export async function assemble(ctx: Ctx, cur: Cur, cand: Candidate): Promise<{ ok: true; seed: Seed } | { ok: false; reason: 'rubric_failed' | 'too_few_sources' }> {
  if (new Set(cand.sourceUrls.map(groupOf)).size < 2) return { ok: false, reason: 'too_few_sources' };
  const ps = cand.paragraphs; if (ps.length < 4) return { ok: false, reason: 'rubric_failed' };
  const ans = [1, 2, 3].map((i) => sentences(ps[Math.min(i, ps.length - 1)])[0]); const hook = sentences(ps[0])[0];
  const raw = await model(ctx, 'questions', WRITER, '', `For each numbered sentence write one short plain question that the sentence answers. Do not add facts, names or numbers that are not in the sentence. Output exactly 3 lines "1. question".\n${ans.map((a, i) => `${i + 1}. ${a}`).join('\n')}`, 200);
  const qs = raw.split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter((l) => l.length > 0);
  if (qs.length < 3 || qs.slice(0, 3).some((q) => !q.endsWith('?') || q.length > 110 || /\d/.test(q))) return { ok: false, reason: 'rubric_failed' };
  const seed: Seed = {
    id: 'g-' + slug(cur.topic!) + '-' + fnv(cur.id).slice(0, 4), countries: cur.countries, title: cur.topic!, tags: cur.tags!, hook,
    beats: ans.map((a, i) => ({ q: qs[i], a })), story: ps, shortKeep: [0, 1], sources: cand.sourceUrls.map((u) => ({ label: hostLabel(u, cur.topic!), url: u })),
    machine: { label: LABEL, flags: cand.licenceFlags, date: new Date().toISOString().slice(0, 10) },
  };
  return { ok: true, seed };
}

export async function health(db: D1Database, now: number): Promise<Health> {
  const q = async (sql: string, ...b: any[]) => (await db.prepare(sql).bind(...b).first<any>()) ?? {};
  const kill = (await getC(db, 'kill_switch')) === '1', over = (await getC(db, 'paused_overage')) === '1';
  const canary = JSON.parse((await getC(db, 'canary')) || 'null') as { ok: boolean; ts: number } | null;
  const pub = (await q("SELECT COUNT(*) n FROM gen_story WHERE status='published'")).n ?? 0;
  const a7 = await q("SELECT COUNT(*) n, SUM(outcome='accepted') ok FROM gen_attempt WHERE ts>=?", now - 7 * 86_400_000);
  const last = (await db.prepare('SELECT reason FROM gen_attempt ORDER BY ts DESC LIMIT 5').all<{ reason: string | null }>()).results ?? [];
  let fails = 0; for (const r of last) { if (r.reason === 'provider_error') fails++; else break; }
  const sp = await spentMicro(db, now);
  return { canaryOk: !!canary?.ok, canaryAgeDays: canary ? (now - canary.ts) / 86_400_000 : null, cap: over ? 'paused_overage' : Math.max(sp.month, sp.trailing30) >= WORKING_CAP_MICRO - 120_000 ? 'exhausted' : 'ok',
    providerFailuresInRow: fails, attempts7d: a7.n ?? 0, accepted7d: a7.ok ?? 0, published: pub, targetPool: TARGET_POOL, lowWater: LOW_WATER, maxAttemptsPerDay: MAX_ATTEMPTS_PER_DAY, flaggedHeld: 0, killSwitch: kill };
}

async function pickTopic(db: D1Database) {
  const seedTitles = SEED.filter((s) => !s.id.startsWith('g-')).map((s) => s.title.toLowerCase());
  const rows = (await db.prepare("SELECT topic, COUNT(*) n, MAX(ts) last, SUM(reason='too_few_sources') nf FROM gen_attempt GROUP BY topic").all<{ topic: string; n: number; last: number; nf: number }>()).results ?? [];
  const pub = new Set(((await db.prepare("SELECT title FROM gen_story").all<{ title: string }>()).results ?? []).map((r) => r.title));
  const info = new Map(rows.map((r) => [r.topic, r]));
  const c = TOPICS.filter((t) => topicAllowed(t) && !pub.has(t.title) && !seedTitles.some((s) => s === t.title.toLowerCase() || s.includes(t.title.toLowerCase())) && (info.get(t.title)?.n ?? 0) < 3 && !(info.get(t.title)?.nf ?? 0)); // a topic without two usable independent sources is not retried
  c.sort((a, b) => (info.get(a.title)?.n ?? 0) - (info.get(b.title)?.n ?? 0) || (info.get(a.title)?.last ?? 0) - (info.get(b.title)?.last ?? 0));
  return c[0] ?? null;
}

async function finishAttempt(db: D1Database, cur: Cur, outcome: 'accepted' | 'rejected', reason: string | null, now: number) {
  await db.batch([
    db.prepare('INSERT OR REPLACE INTO gen_attempt (id,ts,topic,outcome,reason,micro) VALUES (?,?,?,?,?,?)').bind(cur.id, now, cur.topic ?? '', outcome, reason, cur.micro > 0 ? cur.micro : (cur.calls ?? 0) > 0 ? 1 : 0), // a paid call was made even if it failed: its reservation is kept in the ledger
    db.prepare('DELETE FROM gen_cache WHERE attempt=?').bind(cur.id), db.prepare("DELETE FROM gen_control WHERE k='current'"), db.prepare("INSERT INTO gen_control (k,v,updated_at) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at").bind((cur.calls ?? 0) > 0 ? 'last_paid_end' : 'last_noop', String(now), now),
  ]);
}

export async function tick(env: GenEnv, fetchFn: typeof fetch = (...a) => fetch(...a), now = Date.now()): Promise<string> {
  const db = env.DB;
  if (env.GEN_ENABLED !== 'true' || !env.ANTHROPIC_API_KEY) return 'disabled';
  if ((await getC(db, 'kill_switch')) === '1') return 'kill_switch';
  await db.prepare("INSERT OR IGNORE INTO gen_control (k,v,updated_at) VALUES ('lease','0',0)").run();
  const lease = await db.prepare("UPDATE gen_control SET v=?, updated_at=? WHERE k='lease' AND CAST(v AS INTEGER) < ?").bind(String(now + LEASE_MS), now, now).run();
  if (!lease.meta.changes) return 'busy';
  try { return await tickLocked(env, fetchFn, now); } finally { await db.prepare("UPDATE gen_control SET v='0' WHERE k='lease'").run().catch(() => {}); }
}
async function tickLocked(env: GenEnv, fetchFn: typeof fetch, now: number): Promise<string> {
  const db = env.DB;
  let cur: Cur | null = JSON.parse((await getC(db, 'current')) || 'null');
  if (!cur) {
    const h = await health(db, now), d = decide(h);
    const canaryStale = h.canaryAgeDays === null || h.canaryAgeDays > 7 || (!h.canaryOk && h.canaryAgeDays > 1);
    const capLeft = h.cap === 'ok';
    if (canaryStale && capLeft) cur = { id: `canary-${now}`, kind: 'canary', ticks: 0, micro: 0, started: now };
    else if (d.generateAttempts > 0 && capLeft) {
      const today = (await db.prepare("SELECT COUNT(*) n FROM gen_attempt WHERE ts>=? AND micro>0").bind(dayStartMs(now)).first<{ n: number }>())?.n ?? 0;
      const lastEnd = Number((await getC(db, 'last_paid_end')) || 0); // attempts that failed before any paid call do not need spacing
      if (today >= MAX_ATTEMPTS_PER_DAY) return 'daily_attempt_limit';
      if (now - lastEnd < MIN_GAP_MS) return 'spacing';
      const t = await pickTopic(db); if (!t) return 'topics_exhausted';
      cur = { id: `att-${now}`, kind: 'attempt', topic: t.title, tags: t.tags, countries: t.countries, ticks: 0, micro: 0, started: now };
    } else return d.alerts.join(',') || 'idle';
    await setC(db, 'current', JSON.stringify(cur), now);
  }
  const cache = new Map<string, string>(); for (const r of (await db.prepare('SELECT k,v FROM gen_cache WHERE attempt=?').bind(cur.id).all<{ k: string; v: string }>()).results ?? []) cache.set(r.k, r.v);
  const ctx: Ctx = { env, fetchFn, cache, used: 0, max: MAX_EXTERNAL_PER_TICK, yielded: false, stop: null, micro: 0, calls: 0, diag: [], attemptId: cur.id, kind: cur.kind };
  cur.ticks++;
  const park = async () => { cur!.micro += ctx.micro; cur!.calls = (cur!.calls ?? 0) + ctx.calls; await setC(db, 'current', JSON.stringify(cur), now); };
  try {
    if (cur.kind === 'canary') {
      const res: { corrupted: boolean; accepted: boolean }[] = [];
      for (const p of CANARY as { quotes: string; claim: string }[]) { const v = await model(ctx, 'canary', JUDGE, JUDGE_SYSTEM, PROMPTS.judge(p.claim, p.quotes), 8).catch(() => 'ERR'); if (ctx.yielded) throw new Yield(); if (v === 'ERR') throw new Error(ctx.stop || 'error'); res.push({ corrupted: true, accepted: v.trim().toLowerCase() === 'supported' }); }
      const r = canaryOk(res, 20); await setC(db, 'canary', JSON.stringify({ ok: r.ok, ts: now, reason: r.reason ?? null, n: res.length }), now);
      cur.micro += ctx.micro; await db.batch([db.prepare('DELETE FROM gen_cache WHERE attempt=?').bind(cur.id), db.prepare("DELETE FROM gen_control WHERE k='current'")]); return r.ok ? 'canary_ok' : 'canary_failed:' + r.reason;
    }
    const docs = await acquireSources(cur.topic!, cachedFetch(ctx)); if (ctx.yielded) throw new Yield();
    let outcome: { ok: boolean; reason?: string } = { ok: false, reason: 'too_few_sources' }; let seed: Seed | null = null;
    if (!docs || docs.length < 2) await setC(db, 'src_diag', JSON.stringify({ topic: cur.topic, docs: docs ? docs.map((d) => d.groupId) : null, fetched: ctx.diag.slice(0, 12) }), now); // what the network actually returned, kept for diagnosis
    if (docs && docs.length >= 2) {
      const res = await runCandidate(cur.topic!, docs, runners(ctx)); if (ctx.yielded) throw new Yield();
      if (!res.outcome.ok) await setC(db, 'src_diag', JSON.stringify({ topic: cur.topic, reason: res.outcome.reason, notes: ctx.diag.slice(0, 24) }), now);
      if (ctx.stop) outcome = { ok: false, reason: ctx.stop === 'over_cap' ? 'cap_reached' : 'provider_error' };
      else if (!res.outcome.ok) outcome = res.outcome;
      else { const a = await assemble(ctx, cur, res.candidate!); if (ctx.yielded) throw new Yield(); if (ctx.stop) outcome = { ok: false, reason: 'provider_error' }; else if (!a.ok) outcome = a; else { outcome = { ok: true }; seed = a.seed; } }
    }
    if (ctx.stop && ['disabled', 'no_key', 'paused', 'rates_stale'].includes(ctx.stop)) { await park(); return 'parked:' + ctx.stop; }
    cur.micro += ctx.micro; cur.calls = (cur.calls ?? 0) + ctx.calls;
    if (seed) {
      const h = await health(db, now); const pubOk = decide(h).autoPublish && h.canaryOk;
      await db.prepare('INSERT OR IGNORE INTO gen_story (id,title,status,created_at,body,meta) VALUES (?,?,?,?,?,?)').bind(seed.id, seed.title, pubOk ? 'published' : 'held', now, JSON.stringify(seed), JSON.stringify({ attempt: cur.id, micro: cur.micro })).run();
    }
    await finishAttempt(db, cur, outcome.ok ? 'accepted' : 'rejected', outcome.ok ? null : outcome.reason ?? 'unknown', now);
    return outcome.ok ? 'accepted' : 'rejected:' + outcome.reason;
  } catch (e) {
    if (e instanceof Yield || ctx.yielded) { if (cur.ticks >= MAX_TICKS_PER_ATTEMPT) { cur.micro += ctx.micro; cur.calls = (cur.calls ?? 0) + ctx.calls; await finishAttempt(db, cur, 'rejected', 'stuck', now); return 'stuck'; } await park(); return 'yielded'; }
    if (ctx.stop && ['disabled', 'no_key', 'paused', 'rates_stale'].includes(ctx.stop)) { await park(); return 'parked:' + ctx.stop; }
    cur.micro += ctx.micro; cur.calls = (cur.calls ?? 0) + ctx.calls; await finishAttempt(db, cur, 'rejected', ctx.stop === 'over_cap' ? 'cap_reached' : 'provider_error', now); return 'error';
  }
}

// Published generated stories join the served pool. One cheap query per minute per isolate; pulling a story back (status != published) removes it from SEED on the next sync.
let lastSync = 0; const genIds = new Set<string>();
export async function syncSeed(db: D1Database, now = Date.now(), force = false) {
  if (!force && now - lastSync < 60_000) return; lastSync = now;
  const rows = (await db.prepare("SELECT id, body FROM gen_story WHERE status='published'").all<{ id: string; body: string }>()).results ?? [];
  const live = new Set(rows.map((r) => r.id));
  for (const id of [...genIds]) if (!live.has(id)) { const i = SEED.findIndex((s) => s.id === id); if (i >= 0) SEED.splice(i, 1); genIds.delete(id); }
  for (const r of rows) if (!genIds.has(r.id) && !SEED.some((s) => s.id === r.id)) { try { SEED.push(JSON.parse(r.body)); genIds.add(r.id); } catch { /* skip a corrupt row */ } }
}

export async function status(db: D1Database, env: GenEnv, now = Date.now()) {
  const h = await health(db, now); const d = decide(h); const sp = await spentMicro(db, now);
  const by = (await db.prepare("SELECT outcome, COALESCE(reason,'') reason, COUNT(*) n, SUM(micro) micro FROM gen_attempt GROUP BY 1,2").all<any>()).results ?? [];
  const held = (await db.prepare("SELECT COUNT(*) n FROM gen_story WHERE status='held'").first<{ n: number }>())?.n ?? 0;
  const cur = JSON.parse((await getC(db, 'current')) || 'null');
  return { enabled: env.GEN_ENABLED === 'true' && !!env.ANTHROPIC_API_KEY, killSwitch: h.killSwitch, published: h.published, held, attempts7d: h.attempts7d, accepted7d: h.accepted7d, byOutcome: by, spendMicro: sp, workingCapMicro: WORKING_CAP_MICRO, canary: JSON.parse((await getC(db, 'canary')) || 'null'), current: cur && { kind: cur.kind, topic: cur.topic, ticks: cur.ticks }, alerts: d.alerts, notes: 'Spend micro-USD is counted at 1.5x list price. Acceptance is measured from real attempts only.' };
}
