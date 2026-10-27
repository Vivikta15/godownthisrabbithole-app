import { describe, it, expect } from 'vitest';
import { guardedRun, MAX_OUTPUT_TOKENS } from '../src/worker/ai';
const M = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';
function fakeDb() { const t: Record<string, number> = {}; return { prepare(sql: string) { return { bind(...a: any[]) { return { async run() {
  if (sql.startsWith('INSERT')) { t[a[0]] ??= 0; return { meta: { changes: 1 } }; }
  const [n, day, , cap] = a; if (t[day] + n <= cap) { t[day] += n; return { meta: { changes: 1 } }; } return { meta: { changes: 0 } }; } }; } }; }, t } as any; }
const mk = (over: any = {}, calls: any[] = []) => ({ DB: fakeDb(), AI_ENABLED: 'true', AI_PLAN_CONFIRMED: 'free', AI: { async run(m: string, i: any) { calls.push({ m, i }); return { response: 'hi' }; } }, ...over });
describe('guarded AI', () => {
  it('is off by default and needs a human plan confirmation', async () => {
    const calls: any[] = [];
    expect((await guardedRun(mk({ AI_ENABLED: undefined }, calls), { model: M, prompt: 'x' }) as any).reason).toBe('disabled');
    expect((await guardedRun(mk({ AI_PLAN_CONFIRMED: undefined }, calls), { model: M, prompt: 'x' }) as any).reason).toBe('plan_unconfirmed');
    expect((await guardedRun(mk({ AI: undefined }, calls), { model: M, prompt: 'x' }) as any).reason).toBe('no_binding');
    expect(calls.length).toBe(0);
  });
  it('refuses non-allowlisted models and oversized prompts without calling', async () => {
    const calls: any[] = [];
    expect((await guardedRun(mk({}, calls), { model: '@cf/other/paid-model', prompt: 'x' }) as any).reason).toBe('model_not_allowed');
    expect((await guardedRun(mk({}, calls), { model: M, prompt: 'x'.repeat(7000) }) as any).reason).toBe('prompt_too_long');
    expect(calls.length).toBe(0);
  });
  it('always sends a clamped max_tokens', async () => {
    const calls: any[] = [];
    const r = await guardedRun(mk({}, calls), { model: M, prompt: 'hello', maxTokens: 999999 });
    expect(r.ok).toBe(true); expect(calls[0].i.max_tokens).toBe(MAX_OUTPUT_TOKENS);
    await guardedRun(mk({}, calls), { model: M, prompt: 'hello' }); expect(calls[1].i.max_tokens).toBe(400);
  });
  it('stops at the daily cap and never calls past it', async () => {
    const calls: any[] = []; const env = mk({}, calls); let ok = 0, stopped = 0;
    for (let i = 0; i < 400; i++) { const r = await guardedRun(env, { model: M, prompt: 'x'.repeat(2000), maxTokens: 600 }, new Date('2026-10-27T10:00:00Z')); if (r.ok) ok++; else if (r.reason === 'over_daily_cap') stopped++; }
    expect(ok).toBeGreaterThan(0); expect(stopped).toBeGreaterThan(0); expect(calls.length).toBe(ok);
    expect(env.DB.t['2026-10-27']).toBeLessThanOrEqual(8000);
  });
  it('a new UTC day gets a fresh budget', async () => {
    const env = mk(); for (let i = 0; i < 400; i++) await guardedRun(env, { model: M, prompt: 'x'.repeat(2000), maxTokens: 600 }, new Date('2026-10-27T10:00:00Z'));
    expect((await guardedRun(env, { model: M, prompt: 'x' }, new Date('2026-10-28T00:00:01Z'))).ok).toBe(true);
  });
  it('provider errors become a safe result', async () => {
    const r = await guardedRun(mk({ AI: { async run() { throw new Error('boom'); } } }), { model: M, prompt: 'x' }); expect((r as any).reason).toBe('provider_error');
  });
});
