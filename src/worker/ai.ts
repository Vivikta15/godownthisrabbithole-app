// The ONLY allowed way to call Workers AI. Nothing in the app calls it yet and the wrangler config has no AI binding.
// A call happens only if ALL of these hold: AI_ENABLED === 'true' (off switch, default off), AI_PLAN_CONFIRMED === 'free'
// (a human confirmed the account is on the Workers Free plan), env.AI exists, the model is allowlisted, max_tokens is clamped,
// the prompt is length-capped, and an atomic D1 reservation fits under the daily neuron cap. Reservations are never refunded (conservative).
import { estimateNeurons, approxTokens, reserve, budgetDay, DEFAULT_DAILY_CAP } from './aibudget';
export type AiEnv = { AI?: { run(model: string, input: unknown): Promise<any> }; AI_ENABLED?: string; AI_PLAN_CONFIRMED?: string; DB: D1Database };
export const MAX_OUTPUT_TOKENS = 600;
export const MAX_PROMPT_CHARS = 6000;
export const MAX_NEURONS_PER_CALL = 1500;
export type AiResult = { ok: true; text: string } | { ok: false; reason: 'disabled' | 'plan_unconfirmed' | 'no_binding' | 'model_not_allowed' | 'prompt_too_long' | 'over_call_limit' | 'over_daily_cap' | 'provider_error' };

export async function guardedRun(env: AiEnv, req: { model: string; system?: string; prompt: string; maxTokens?: number }, now = new Date()): Promise<AiResult> {
  if (env.AI_ENABLED !== 'true') return { ok: false, reason: 'disabled' };
  if (env.AI_PLAN_CONFIRMED !== 'free') return { ok: false, reason: 'plan_unconfirmed' };
  if (!env.AI) return { ok: false, reason: 'no_binding' };
  const text = (req.system ?? '') + req.prompt;
  if (text.length > MAX_PROMPT_CHARS) return { ok: false, reason: 'prompt_too_long' };
  const maxTokens = Math.max(1, Math.min(MAX_OUTPUT_TOKENS, Math.floor(req.maxTokens ?? 400)));
  const est = estimateNeurons(req.model, approxTokens(text), maxTokens);
  if (est === null) return { ok: false, reason: 'model_not_allowed' };
  if (est > MAX_NEURONS_PER_CALL) return { ok: false, reason: 'over_call_limit' };
  if (!(await reserve(env.DB, budgetDay(now), est, DEFAULT_DAILY_CAP))) return { ok: false, reason: 'over_daily_cap' };
  try {
    const messages = [...(req.system ? [{ role: 'system', content: req.system }] : []), { role: 'user', content: req.prompt }];
    const out = await env.AI.run(req.model, { messages, max_tokens: maxTokens });
    const resp = out?.response; // Workers AI may hand back already-parsed JSON as an object
    return { ok: true, text: typeof resp === 'string' ? resp : resp == null ? '' : JSON.stringify(resp) };
  } catch { return { ok: false, reason: 'provider_error' }; }
}
