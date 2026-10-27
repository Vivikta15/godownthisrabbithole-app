import { describe, it, expect } from 'vitest';
import { worstCaseMicroUsd, paidRun } from '../src/worker/anthropic';
const db = (changes: number) => ({ prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes } }) }) }) }) as any;
describe('paid guard', () => {
  it('off by default and without cap or key', async () => {
    expect(await paidRun({ DB: db(1) }, { model: 'claude-haiku-5-5', prompt: 'x' })).toEqual({ ok: false, reason: 'disabled' });
    expect((await paidRun({ DB: db(1), ANTHROPIC_ENABLED: 'true' }, { model: 'claude-haiku-5-5', prompt: 'x' }) as any).reason).toBe('no_cap');
    expect((await paidRun({ DB: db(1), ANTHROPIC_ENABLED: 'true', ANTHROPIC_TRIAL_CAP_MICROUSD: '2000000' }, { model: 'claude-haiku-5-5', prompt: 'x' }) as any).reason).toBe('no_key');
  });
  it('rejects unknown models and over-cap without calling the network', async () => {
    let called = 0; const f: any = async () => { called++; return { ok: true, json: async () => ({}) }; };
    const e = { DB: db(0), ANTHROPIC_ENABLED: 'true', ANTHROPIC_TRIAL_CAP_MICROUSD: '2000000', ANTHROPIC_API_KEY: 'k' };
    expect((await paidRun(e, { model: 'other', prompt: 'x' }, f) as any).reason).toBe('model_not_allowed');
    expect((await paidRun(e, { model: 'claude-haiku-5-5', prompt: 'x' }, f) as any).reason).toBe('over_cap');
    expect(called).toBe(0);
  });
  it('worst case math uses full body bytes', () => {
    const body = JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 350, messages: [{ role: 'user', content: 'a'.repeat(1000) }] });
    expect(worstCaseMicroUsd('claude-haiku-5-5', body, 350)).toBe(Math.ceil((new TextEncoder().encode(body).length * 100000 + 350 * 500000) / 1e6));
    expect(worstCaseMicroUsd('unknown', body, 350)).toBeNull();
  });
});
