// Spend control for the autonomous story generator. Owner-approved ceiling: $3.50 per month for ALL generator use, tests included. Nothing else is authorised.
// Rates are list prices from platform.claude.com/docs/en/about-claude/pricing and /models/all-models (read 2026-10-28). They are provisional: the Models API confirms IDs, not prices.
export const HARD_CEILING_MICRO = 3_500_000;      // the owner's number; code never exceeds it
export const WORKING_CAP_MICRO = 3_300_000;       // used cap: leaves margin for anything provider billing counts that we do not
export const RATES: Record<string, { in: number; out: number; thinkingOff: 'disabled' | 'between_tools' }> = { // micro-USD per token == USD per MTok
  'claude-haiku-5-5': { in: 0.1, out: 0.5, thinkingOff: 'disabled' },
  'claude-sonnet-5': { in: 2, out: 10, thinkingOff: 'disabled' },
  'claude-sonnet-5-5': { in: 2, out: 10, thinkingOff: 'between_tools' },
};
export const MAX_PROMPT_BYTES = 40_000; // keeps Haiku 5.5 well under its 100k-token cheap tier even at 1 token per byte
export const monthStartMs = (now: number) => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
const DAY = 86_400_000;
// The owner's "monthly limit" could reset on the calendar month or a billing cycle; we do not know which. A reservation must fit under the cap in BOTH the
// current UTC calendar month and the trailing 30 days, so neither reading can be exceeded.
export const RESERVE_SQL = `INSERT INTO gen_spend_log (id, ts, micro, state, note) SELECT ?1, ?2, ?3, 'reserved', ?7 WHERE (SELECT COALESCE(SUM(micro),0) FROM gen_spend_log WHERE ts >= ?4) + ?3 <= ?5 AND (SELECT COALESCE(SUM(micro),0) FROM gen_spend_log WHERE ts >= ?6) + ?3 <= ?5 AND (SELECT COALESCE(SUM(micro),0) FROM gen_spend_log WHERE ts >= ?8) + ?3 <= ?9`;
// Pacing: the cap is for the WHOLE month, so no single UTC day may use more than twice the even daily share (cap/30). Unused days are not banked beyond that, so an evaluation or a
// failure loop cannot burn the month in a day. The month and trailing-30-day caps above remain the real limits.
export const dayCapMicro = (cap: number) => Math.floor((2 * cap) / 30);
export const dayStartMs = (now: number) => { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
export const worstCaseMicro = (model: string, promptBytes: number, maxOut: number): number | null => { const r = Object.prototype.hasOwnProperty.call(RATES, model) ? RATES[model] : undefined; return r ? Math.ceil(promptBytes * r.in + maxOut * r.out) : null; };
export const actualMicro = (model: string, usage: { input_tokens?: number; output_tokens?: number } | undefined): number | null => { const r = Object.prototype.hasOwnProperty.call(RATES, model) ? RATES[model] : undefined; if (!r || !usage || typeof usage.input_tokens !== 'number' || typeof usage.output_tokens !== 'number') return null; return Math.ceil(usage.input_tokens * r.in + usage.output_tokens * r.out); };

export async function reserve(db: D1Database, id: string, micro: number, note: string, now = Date.now(), cap = WORKING_CAP_MICRO): Promise<boolean> {
  if (!(micro > 0) || cap > HARD_CEILING_MICRO) return false;
  const r = await db.prepare(RESERVE_SQL).bind(id, now, micro, monthStartMs(now), cap, now - 30 * DAY, note, dayStartMs(now), dayCapMicro(cap)).run();
  return r.meta.changes === 1;
}
// Success: replace the reservation by the provider-reported usage (never more than reserved). If usage is missing, keep the full reservation.
export async function settleOk(db: D1Database, id: string, reservedMicro: number, actual: number | null): Promise<void> {
  if (actual === null) { await db.prepare("UPDATE gen_spend_log SET state='settled_unmeasured' WHERE id=?").bind(id).run(); return; }
  if (actual > reservedMicro) { await db.prepare("UPDATE gen_spend_log SET micro=?, state='overage' WHERE id=?").bind(actual, id).run(); await db.prepare("INSERT OR REPLACE INTO gen_control (k,v,updated_at) VALUES ('paused_overage','1',?)").bind(Date.now()).run(); return; }
  await db.prepare("UPDATE gen_spend_log SET micro=?, state='settled' WHERE id=?").bind(Math.max(1, actual), id).run();
}
// Failure (network error, non-2xx, unparseable): billing is unknown, so the full reservation stays.
export async function settleFailed(db: D1Database, id: string): Promise<void> { await db.prepare("UPDATE gen_spend_log SET state='failed_kept' WHERE id=?").bind(id).run(); }
export async function spentMicro(db: D1Database, now = Date.now()): Promise<{ month: number; trailing30: number }> {
  const m = await db.prepare('SELECT COALESCE(SUM(micro),0) s FROM gen_spend_log WHERE ts>=?').bind(monthStartMs(now)).first<{ s: number }>();
  const t = await db.prepare('SELECT COALESCE(SUM(micro),0) s FROM gen_spend_log WHERE ts>=?').bind(now - 30 * DAY).first<{ s: number }>();
  return { month: m?.s ?? 0, trailing30: t?.s ?? 0 };
}

export type GenEnv = { DB: D1Database; GEN_ENABLED?: string; ANTHROPIC_API_KEY?: string };
export type CallResult = { ok: true; text: string; micro: number } | { ok: false; reason: 'disabled' | 'no_key' | 'paused' | 'bad_model' | 'prompt_too_long' | 'over_cap' | 'provider_error' };
// One paid call: gates, reserve, one fetch (no automatic retry; a retry is a new reservation), settle. Thinking is switched off where the model allows it, and max_tokens bounds any output anyway.
export async function callModel(env: GenEnv, req: { model: string; system?: string; prompt: string; maxTokens: number; id: string; note: string }, fetchFn: typeof fetch = fetch): Promise<CallResult> {
  if (env.GEN_ENABLED !== 'true') return { ok: false, reason: 'disabled' };
  if (!env.ANTHROPIC_API_KEY) return { ok: false, reason: 'no_key' };
  const paused = await env.DB.prepare("SELECT v FROM gen_control WHERE k IN ('paused_overage','kill_switch') AND v='1'").first(); if (paused) return { ok: false, reason: 'paused' };
  const rate = Object.prototype.hasOwnProperty.call(RATES, req.model) ? RATES[req.model] : undefined; if (!rate) return { ok: false, reason: 'bad_model' };
  const body = JSON.stringify({ model: req.model, max_tokens: req.maxTokens, ...(req.system ? { system: req.system } : {}), thinking: { type: rate.thinkingOff }, messages: [{ role: 'user', content: req.prompt }] });
  const bytes = new TextEncoder().encode(body).length; if (bytes > MAX_PROMPT_BYTES) return { ok: false, reason: 'prompt_too_long' };
  const micro = worstCaseMicro(req.model, bytes, req.maxTokens)!;
  if (!(await reserve(env.DB, req.id, micro, req.note))) return { ok: false, reason: 'over_cap' };
  try {
    const res = await fetchFn('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body });
    if (!res.ok) { await settleFailed(env.DB, req.id); return { ok: false, reason: 'provider_error' }; }
    const j: any = await res.json(); const act = actualMicro(req.model, j.usage); await settleOk(env.DB, req.id, micro, act);
    return { ok: true, text: (j.content ?? []).map((b: any) => b.text ?? '').join(''), micro: act ?? micro };
  } catch { await settleFailed(env.DB, req.id); return { ok: false, reason: 'provider_error' }; }
}
