// No-spend guard for Cloudflare Workers AI. The user approved the FREE allowance only (10,000 neurons/day) and stopping at the limit.
// Rates are from developers.cloudflare.com/workers-ai/platform/pricing (read 2026-10-27); re-check before relying on them.
// Only allowlisted free-tier-capable models may be called; anything else is refused. The cap sits below the free allocation as a margin.
export const FREE_DAILY_NEURONS = 10000;
export const DEFAULT_DAILY_CAP = 8000;
export const MODEL_RATES: Record<string, { inPerM: number; outPerM: number }> = {
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast': { inPerM: 4119, outPerM: 34868 },
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { inPerM: 26668, outPerM: 204805 },
};
export function estimateNeurons(model: string, inTokens: number, outTokens: number): number | null {
  const r = Object.prototype.hasOwnProperty.call(MODEL_RATES, model) ? MODEL_RATES[model] : undefined;
  if (!r) return null;
  return Math.ceil((inTokens * r.inPerM + outTokens * r.outPerM) / 1e6);
}
// Worst case for a call = prompt tokens (approx 4 chars/token, rounded up) + the max_tokens we will request.
export const approxTokens = (s: string) => Math.ceil(s.length / 4);

export async function reserve(db: D1Database, day: string, neurons: number, cap = DEFAULT_DAILY_CAP): Promise<boolean> {
  if (!(neurons > 0) || cap > FREE_DAILY_NEURONS) return false;
  await db.prepare('INSERT OR IGNORE INTO ai_usage (day,neurons) VALUES (?,0)').bind(day).run();
  // atomic: the UPDATE only applies if the reservation fits under the cap, so parallel calls cannot overshoot
  const r = await db.prepare('UPDATE ai_usage SET neurons=neurons+? WHERE day=? AND neurons+?<=?').bind(neurons, day, neurons, cap).run();
  return r.meta.changes === 1;
}
// Day boundary: Cloudflare's free allocation resets daily at 00:00 UTC (docs), so budget by UTC day.
export const budgetDay = (d = new Date()) => d.toISOString().slice(0, 10);
