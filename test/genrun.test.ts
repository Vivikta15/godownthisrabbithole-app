import { describe, it, expect } from 'vitest';
import { mkdb } from './d1shim';
import { tick, syncSeed, status, MAX_EXTERNAL_PER_TICK } from '../src/worker/genrun';
import { SEED } from '../src/content/seed';
import CANARY from '../src/gen/canary.json';
import { WORKING_CAP_MICRO } from '../src/worker/genspend';
// FIXTURE WORLD. These tests prove orchestration, resumption, gates and ledger behaviour with scripted network and model replies.
// They do NOT show that a real model writes true or good stories; real acceptance and cost come only from live runs.
const FACTS = ['The first passenger line opened in 1853', 'Trains run on broad gauge tracks across the country', 'Station names are written in several scripts', 'Tea sellers walk the platforms with kettles', 'Tickets can be booked on a phone application'];
const KEYS = ['opened_year', 'gauge', 'scripts', 'tea', 'tickets'], VALS = ['1853', 'broad', 'several', 'kettles', 'phone'];
const PAD = ' The Indian railway network is large and busy, and the railway is part of daily life.'.repeat(30);
const PAGE = FACTS.join('. ') + '.' + PAD;
const bad = new Set((CANARY as any[]).map((c) => c.claim));
function world(opts: { judge?: (claim: string) => string } = {}) {
  const log = { external: 0, anthropic: 0, perTick: 0, models: [] as string[] };
  const f = (async (url: string, init?: any) => {
    url = String(url);
    if (url.includes('api.anthropic.com')) {
      log.anthropic++; log.perTick++; const b = JSON.parse(init.body); const p: string = b.messages[0].content; log.models.push(b.model);
      const usage = { input_tokens: 300, output_tokens: 5 }; const reply = (t: string) => ({ ok: true, json: async () => ({ content: [{ text: t }], usage }) });
      if (p.startsWith('You are extracting')) return reply(FACTS.map((q, i) => `${KEYS[i]} | ${VALS[i]} | ${q}`).join('\n'));
      if (p.startsWith('Plan a 7')) return reply([1, 2, 3, 4, 5].map((n) => `paragraph ${n}: purpose ${n} | c${n}`).join('\n'));
      if (p.startsWith('Write one paragraph')) { const m = p.match(/\[(c\d+)\] (.*)$/m)!; return reply(`${m[2]}. || ${m[1]}`); }
      if (p.startsWith('Find defects')) return reply('none');
      if (p.startsWith('For each numbered')) return reply('1. What opened first?\n2. How are the tracks laid?\n3. Which scripts appear?');
      if (p.startsWith('SOURCE:')) { const claim = p.match(/CLAIM: (.*)\n/)![1]; return reply(opts.judge ? opts.judge(claim) : bad.has(claim) ? 'NOT' : 'SUPPORTED'); }
      throw new Error('unscripted prompt ' + p.slice(0, 40));
    }
    log.external++; log.perTick++;
    const J = (o: any) => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => o, text: async () => JSON.stringify(o) });
    if (url.includes('prop=extracts')) return J({ query: { pages: [{ title: 'T', extract: PAGE.slice(0, 2500), revisions: [{ revid: 9 }] }] } });
    if (url.includes('prop=extlinks')) return J({ query: { pages: [{ extlinks: [{ url: 'https://news.example.com/a' }, { url: 'https://other.example.org/b' }, { url: 'https://third.example.net/c' }] }] } });
    return { ok: true, url, headers: { get: () => 'text/html' }, text: async () => `<html><body><p>${PAGE}</p></body></html>` };
  }) as any;
  return { f, log };
}
async function run(db: any, env: any, w: ReturnType<typeof world>, ticks: number, t0 = Date.UTC(2026, 9, 28, 8)) {
  const out: string[] = []; let maxPer = 0;
  for (let i = 0; i < ticks; i++) { w.log.perTick = 0; out.push(await tick(env, w.f, t0 + i * 5 * 60_000)); maxPer = Math.max(maxPer, w.log.perTick); }
  return { out, maxPer };
}
const on = (db: any) => ({ DB: db, GEN_ENABLED: 'true', ANTHROPIC_API_KEY: 'test-key' });
describe('autonomous generator end to end, fixture world', () => {
  it('canary, then a resumable attempt, then a published story in the served pool', async () => {
    const { db, raw } = mkdb(); const w = world(); const { out, maxPer } = await run(db, on(db), w, 14);
    expect(out.filter((x) => x === 'yielded').length).toBeGreaterThanOrEqual(3); expect(maxPer).toBeLessThanOrEqual(MAX_EXTERNAL_PER_TICK);
    expect(out).toContain('canary_ok'); expect(out).toContain('accepted');
    const story: any = raw.prepare("SELECT * FROM gen_story").get(); expect(story.status).toBe('published');
    const seed = JSON.parse(story.body); expect(seed.beats.length).toBe(3); expect(seed.story.length).toBe(5); expect(seed.machine.label).toMatch(/Not verified by a person/);
    expect(new Set(seed.sources.map((s: any) => new URL(s.url).hostname)).size).toBeGreaterThanOrEqual(2); expect(seed.sources.some((s: any) => /CC BY-SA/.test(s.label))).toBe(true);
    expect(seed.id.startsWith('g-')).toBe(true); expect(w.log.models.every((m) => m === 'claude-haiku-5-5' || m === 'claude-sonnet-5')).toBe(true);
    expect((raw.prepare('SELECT COUNT(*) n FROM gen_cache').get() as any).n).toBe(0);
    const spent = (raw.prepare('SELECT SUM(micro) s FROM gen_spend_log').get() as any).s; expect(spent).toBeGreaterThan(0); expect(spent).toBeLessThan(WORKING_CAP_MICRO);
    const n0 = SEED.length; await syncSeed(db, Date.now(), true); expect(SEED.length).toBe(n0 + 1); expect(SEED.some((s) => s.id === seed.id)).toBe(true);
    raw.prepare("UPDATE gen_story SET status='held'").run(); await syncSeed(db, Date.now(), true); expect(SEED.length).toBe(n0);
    const st = await status(db, on(db)); expect(st.published).toBe(0); expect(st.held).toBe(1); expect(st.canary?.ok).toBe(true);
  });
  it('one unsupported sentence withholds the story, and nothing is published', async () => {
    const { db, raw } = mkdb(); const w = world({ judge: (c) => (FACTS.some((x) => c.startsWith(x)) && c.includes('kettles') ? 'NOT' : bad.has(c) ? 'NOT' : 'SUPPORTED') });
    const { out } = await run(db, on(db), w, 14); expect(out.some((x) => x.startsWith('rejected:'))).toBe(true);
    expect((raw.prepare("SELECT COUNT(*) n FROM gen_story").get() as any).n).toBe(0); expect((raw.prepare("SELECT outcome FROM gen_attempt").get() as any).outcome).toBe('rejected');
  });
  it('a judge that accepts a known-bad claim fails the canary and blocks generation', async () => {
    const { db, raw } = mkdb(); const w = world({ judge: () => 'SUPPORTED' }); const { out } = await run(db, on(db), w, 12);
    expect(out).toContain('canary_failed:false_accept'); expect((raw.prepare("SELECT COUNT(*) n FROM gen_attempt").get() as any).n).toBe(0); expect(out.at(-1)).toMatch(/judge_canary_failed/);
  });
  it('is inert unless enabled with a key, and the kill switch stops it', async () => {
    const { db, raw } = mkdb(); const w = world();
    expect(await tick({ DB: db, ANTHROPIC_API_KEY: 'k' }, w.f)).toBe('disabled'); expect(await tick({ DB: db, GEN_ENABLED: 'true' }, w.f)).toBe('disabled');
    raw.prepare("INSERT INTO gen_control VALUES ('kill_switch','1',0)").run(); expect(await tick(on(db), w.f)).toBe('kill_switch'); expect(w.log.anthropic + w.log.external).toBe(0);
  });
  it('the lease is released after every tick so a 3-minute cron is never skipped', async () => { const { db, raw } = mkdb(); const w = world(); await tick(on(db), w.f, Date.UTC(2026, 9, 28, 8)); expect((raw.prepare("SELECT v FROM gen_control WHERE k='lease'").get() as any).v).toBe('0'); expect(await tick(on(db), w.f, Date.UTC(2026, 9, 28, 8) + 3 * 60_000)).not.toBe('busy'); });
  it('a full cap stops everything before any network call', async () => {
    const { db, raw } = mkdb(); const w = world(); raw.prepare("INSERT INTO gen_spend_log VALUES ('full', ?, ?, 'settled', '')").run(Date.UTC(2026, 9, 20), WORKING_CAP_MICRO);
    const r = await tick(on(db), w.f, Date.UTC(2026, 9, 28, 8)); expect(r).toMatch(/cap_exhausted/); expect(w.log.anthropic + w.log.external).toBe(0);
  });
  it('a provider failure ends the attempt as provider_error and keeps the reservation', async () => {
    const { db, raw } = mkdb(); const w = world(); const orig = w.f; let n = 0;
    const f = (async (u: any, i: any) => { if (String(u).includes('anthropic') && ++n > 30) return { ok: false } as any; return orig(u, i); }) as any;
    const o: string[] = []; for (let i = 0; i < 14; i++) o.push(await tick(on(db), f, Date.UTC(2026, 9, 28, 8) + i * 5 * 60_000)); 
    expect((raw.prepare("SELECT reason FROM gen_attempt").get() as any)?.reason).toBe('provider_error'); expect((raw.prepare("SELECT COUNT(*) n FROM gen_spend_log WHERE state='failed_kept'").get() as any).n).toBe(1);
  });
});
