// Preparation only. Pure functions, no network, not wired to any route. Nothing here calls a paid API.
// A claim ledger records what each source says. Agreement between independent sources is evidence for a claim; it is not proof,
// and it does not settle who may reuse the text (see License) or whether a person has verified the story.

export type License = 'cc-by-sa' | 'cc-by' | 'public-domain' | 'all-rights-reserved' | 'unknown';
export type Source = { id: string; url: string; publisher: string; license: License; groupId: string }; // groupId: sources that copy or derive from each other share one group
export type Claim = { id: string; sourceId: string; key: string; value: string; quote: string }; // key: what is claimed about (e.g. "dabbawala.start_year"); value: normalised answer

export type ClaimStatus = 'central' | 'single' | 'disputed';
export type ClaimGroup = { key: string; status: ClaimStatus; values: { value: string; groups: string[]; claimIds: string[] }[] };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// central: two or more independent source groups give the same value and none give another. disputed: independent groups give different values. single: one group only.
export function classifyClaims(sources: Source[], claims: Claim[]): ClaimGroup[] {
  const grp = new Map(sources.map((s) => [s.id, s.groupId] as const));
  const byKey = new Map<string, Claim[]>();
  for (const c of claims) { if (!grp.has(c.sourceId)) continue; byKey.set(c.key, [...(byKey.get(c.key) ?? []), c]); }
  return [...byKey.entries()].map(([key, cs]) => {
    const byVal = new Map<string, { groups: Set<string>; ids: string[] }>();
    for (const c of cs) { const v = norm(c.value); const e = byVal.get(v) ?? { groups: new Set<string>(), ids: [] }; e.groups.add(grp.get(c.sourceId)!); e.ids.push(c.id); byVal.set(v, e); }
    const values = [...byVal.entries()].map(([value, e]) => ({ value, groups: [...e.groups].sort(), claimIds: e.ids }));
    const allGroups = new Set(values.flatMap((v) => v.groups));
    const status: ClaimStatus = values.length > 1 ? 'disputed' : allGroups.size >= 2 ? 'central' : 'single';
    return { key, status, values };
  });
}

// What the writer may state. central: plainly. single: only with "according to <source>". disputed: only as a disagreement, never as a plain fact.
export function allowedPhrasing(status: ClaimStatus): 'plain' | 'attributed' | 'disagreement_only' { return status === 'central' ? 'plain' : status === 'single' ? 'attributed' : 'disagreement_only'; }

// Reuse terms are tracked per source. A story that paraphrases a cc-by-sa source needs attribution and may need a share-alike licence. This is a flag for a human, not a legal opinion.
export function licenceFlags(sources: Source[], usedSourceIds: string[]): string[] {
  const used = sources.filter((s) => usedSourceIds.includes(s.id)); const out: string[] = [];
  if (used.some((s) => s.license === 'cc-by-sa')) out.push('attribution and share-alike apply to derived text from a CC BY-SA source: check before wider or commercial use');
  if (used.some((s) => s.license === 'cc-by')) out.push('attribution required');
  if (used.some((s) => s.license === 'all-rights-reserved' || s.license === 'unknown')) out.push('reuse terms unknown or restricted: use facts only, never copied wording, and ask before relying on it');
  return out;
}

// Every candidate ends in exactly one of these. Rejections are counted, because the acceptance rate drives cost.
export type Rejection = 'too_few_sources' | 'disputed_stated_as_fact' | 'unsupported_sentence' | 'qualifier_dropped' | 'repeated_fact' | 'rubric_failed' | 'cap_reached' | 'provider_error' | 'prompt_leak';
export type Outcome = { ok: true } | { ok: false; reason: Rejection };

export function acceptanceRate(outcomes: Outcome[]): number | null { return outcomes.length ? outcomes.filter((o) => o.ok).length / outcomes.length : null; }
export function rejectionCounts(outcomes: Outcome[]): Partial<Record<Rejection, number>> { const r: Partial<Record<Rejection, number>> = {}; for (const o of outcomes) if (!o.ok) r[o.reason] = (r[o.reason] ?? 0) + 1; return r; }

// Pool state is shown to the owner. "empty" must be visible, never hidden by a fallback.
export type PoolState = 'healthy' | 'low' | 'empty' | 'paused_cap';
export function poolState(p: { published: number; lowWater: number; capReached: boolean }): PoolState { if (p.published <= 0) return p.capReached ? 'paused_cap' : 'empty'; if (p.capReached && p.published < p.lowWater) return 'paused_cap'; return p.published < p.lowWater ? 'low' : 'healthy'; }

// Monthly spend ledger, integer micro-dollars. reserve before a call, never refund; month is YYYY-MM.
export type SpendMonth = { month: string; reservedMicro: number };
export function tryReserve(m: SpendMonth, month: string, micro: number, capMicro: number): { ok: boolean; next: SpendMonth } {
  const cur = m.month === month ? m : { month, reservedMicro: 0 };
  if (!(micro > 0) || !(capMicro > 0) || cur.reservedMicro + micro > capMicro) return { ok: false, next: cur };
  return { ok: true, next: { month, reservedMicro: cur.reservedMicro + micro } };
}

// Cost forecast. All inputs are assumptions, shown with the result; rates are provisional until read from the owner's own account.
export type Rates = { inPerM: number; outPerM: number }; // USD per million tokens
export type Forecast = { tokensIn: number; tokensOut: number; retryFactor: number; sourceFactor: number; acceptance: number; writer: Rates; judge: Rates; judgeShare: number; searches?: number; searchUsd?: number };
// judgeShare: fraction of tokens that go to the judge model. Result is USD per ACCEPTED story: attempt cost divided by acceptance rate.
export function costPerAcceptedUsd(f: Forecast): number {
  const inT = f.tokensIn * f.sourceFactor * f.retryFactor, outT = f.tokensOut * f.retryFactor;
  const price = (r: Rates, share: number) => (inT * share * r.inPerM + outT * share * r.outPerM) / 1e6;
  const attempt = price(f.judge, f.judgeShare) + price(f.writer, 1 - f.judgeShare) + (f.searches ?? 0) * (f.searchUsd ?? 0);
  return f.acceptance > 0 ? attempt / f.acceptance : Infinity;
}

// ---- Hard-cap reservations. A cap must bound what could be BILLED, not what was accepted. ----
// Worst case of one call: prompt bytes (a token covers at least one byte, so bytes bound tokens) at the input rate, plus max_tokens at the output rate.
// max_tokens includes billed thinking, so it covers thinking. Searches are billed per use, so each allowed search is reserved at its price. A failed call is still reserved
// (billing for errors is not guaranteed to be zero) and is not refunded. Overage is recorded and pauses generation.
export type CallSpec = { inRatePerM: number; outRatePerM: number; promptBytes: number; maxTokens: number; maxSearches: number; usdPerThousandSearches: number; batchDiscount?: number };
export const worstCaseMicro = (c: CallSpec): number => Math.ceil(((c.promptBytes * c.inRatePerM + c.maxTokens * c.outRatePerM) * (c.batchDiscount ?? 1)) + (c.maxSearches * c.usdPerThousandSearches * 1000));
// (rates are USD/MTok = micro-USD per token; search USD per 1000 => micro-USD per search = usdPerThousand * 1000)
export type Reservation = { id: string; month: string; micro: number; settled?: { actualMicro: number } };
export type CapState = { capMicro: number; reservations: Reservation[]; paused: boolean };
const monthTotal = (s: CapState, month: string) => s.reservations.filter((r) => r.month === month).reduce((a, r) => a + Math.max(r.micro, r.settled?.actualMicro ?? 0), 0);
// All reservations, in flight or settled, count against the cap. Concurrent callers must reserve one at a time; in D1 this is a single conditional UPDATE, as in src/worker/aibudget.ts.
export function reserveCall(s: CapState, id: string, month: string, micro: number): { ok: boolean; state: CapState; reason?: 'paused' | 'over_cap' | 'bad_amount' | 'duplicate' } {
  if (s.paused) return { ok: false, state: s, reason: 'paused' };
  if (!(micro > 0)) return { ok: false, state: s, reason: 'bad_amount' };
  if (s.reservations.some((r) => r.id === id)) return { ok: false, state: s, reason: 'duplicate' };
  if (monthTotal(s, month) + micro > s.capMicro) return { ok: false, state: s, reason: 'over_cap' };
  return { ok: true, state: { ...s, reservations: [...s.reservations, { id, month, micro }] } };
}
// Settling records actual billed micro-USD from the response usage. A smaller actual does not free cap (no refund). A larger one is an overage and pauses generation.
export function settleCall(s: CapState, id: string, actualMicro: number): CapState {
  const rs = s.reservations.map((r) => (r.id === id ? { ...r, settled: { actualMicro } } : r)); const r0 = s.reservations.find((r) => r.id === id);
  return { ...s, reservations: rs, paused: s.paused || (!!r0 && actualMicro > r0.micro) };
}
// A call reserved in one month that finishes in the next stays in the month it was reserved in (conservative; also check the provider invoice).
