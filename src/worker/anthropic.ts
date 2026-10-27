// OPTIONAL paid path. OFF unless ALL hold: ANTHROPIC_ENABLED==='true', ANTHROPIC_TRIAL_CAP_MICROUSD is a positive number the owner approved in writing,
// ANTHROPIC_API_KEY secret exists. Every call reserves its WORST CASE cost (input tokens x1.3 tokenizer margin at list price + full max_tokens at output price)
// atomically against the lifetime cap BEFORE the request; reservations are never refunded. Prices: https://platform.claude.com/docs/en/about-claude/pricing (read 2026-10-27).
export const PRICES_MICROUSD_PER_MTOK: Record<string, { in: number; out: number }> = {
  'claude-haiku-5-5': { in: 100_000, out: 500_000 },   // $0.10 / $0.50 per MTok, prompts up to 100k tokens
  'claude-sonnet-5-5': { in: 2_000_000, out: 10_000_000 }, // $2 / $10 per MTok
};
export const MAX_TRIAL_CAP_MICROUSD = 2_000_000; // hard ceiling in code: $2 total, the amount asked of the owner
export const MAX_OUT = 700; export const MAX_PROMPT_CHARS = 12000;
export type PaidEnv = { DB: D1Database; ANTHROPIC_ENABLED?: string; ANTHROPIC_TRIAL_CAP_MICROUSD?: string; ANTHROPIC_API_KEY?: string };
export const approxTokens = (s: string) => Math.ceil(s.length / 3); // pessimistic (about 3 chars per token)
export function worstCaseMicroUsd(model: string, text: string, maxOut: number): number | null {
  const p = PRICES_MICROUSD_PER_MTOK[model]; if (!p) return null;
  return Math.ceil((approxTokens(text) * 1.3 * p.in + maxOut * p.out) / 1_000_000);
}
export type PaidResult = { ok: true; text: string; usage?: { input_tokens?: number; output_tokens?: number } } | { ok: false; reason: 'disabled' | 'no_cap' | 'no_key' | 'model_not_allowed' | 'prompt_too_long' | 'over_cap' | 'provider_error' };
export async function paidRun(env: PaidEnv, req: { model: string; system?: string; prompt: string; maxTokens?: number }, fetchFn: typeof fetch = fetch): Promise<PaidResult> {
  if (env.ANTHROPIC_ENABLED !== 'true') return { ok: false, reason: 'disabled' };
  const cap = Math.min(Number(env.ANTHROPIC_TRIAL_CAP_MICROUSD), MAX_TRIAL_CAP_MICROUSD);
  if (!(cap > 0)) return { ok: false, reason: 'no_cap' };
  if (!env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const text = (req.system ?? '') + req.prompt; if (text.length > MAX_PROMPT_CHARS) return { ok: false, reason: 'prompt_too_long' };
  const maxOut = Math.max(1, Math.min(MAX_OUT, Math.floor(req.maxTokens ?? 400)));
  const cost = worstCaseMicroUsd(req.model, text, maxOut); if (cost === null) return { ok: false, reason: 'model_not_allowed' };
  const r = await env.DB.prepare('UPDATE paid_spend SET reserved_microusd=reserved_microusd+? WHERE id=1 AND reserved_microusd+?<=?').bind(cost, cost, cap).run();
  if (r.meta.changes !== 1) return { ok: false, reason: 'over_cap' };
  try {
    const res = await fetchFn('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: req.model, max_tokens: maxOut, ...(req.system ? { system: req.system } : {}), messages: [{ role: 'user', content: req.prompt }] }) });
    if (!res.ok) return { ok: false, reason: 'provider_error' };
    const j: any = await res.json(); return { ok: true, text: (j.content ?? []).map((b: any) => b.text ?? '').join(''), usage: j.usage };
  } catch { return { ok: false, reason: 'provider_error' }; }
}
