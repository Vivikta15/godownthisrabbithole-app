import { describe, it, expect } from 'vitest';
import { classifyClaims, allowedPhrasing, licenceFlags, acceptanceRate, rejectionCounts, poolState, tryReserve, costPerAcceptedUsd } from '../src/gen/ledger';
import { canOpenNew, CURRENT_POLICY } from '../src/gen/policy';
// Fixtures mirror the dabbawala corroboration pass (real disagreement on origin details).
const sources = [
  { id: 'wp', url: 'https://en.wikipedia.org/wiki/Dabbawala', publisher: 'Wikipedia', license: 'cc-by-sa' as const, groupId: 'wp' },
  { id: 'guardian', url: 'https://www.theguardian.com/world/2008/aug/20/india-travelfoodanddrink', publisher: 'The Guardian', license: 'all-rights-reserved' as const, groupId: 'guardian' },
  { id: 'obp', url: 'https://books.openbookpublishers.com/10.11647/obp.0031/10_Chapter1.html', publisher: 'Open Book Publishers', license: 'unknown' as const, groupId: 'obp' },
  { id: 'mirror', url: 'https://example.test/wp-mirror', publisher: 'mirror', license: 'cc-by-sa' as const, groupId: 'wp' },
];
const claims = [
  { id: 'c1', sourceId: 'guardian', key: 'start_year', value: '1890', quote: 'established in 1890' },
  { id: 'c2', sourceId: 'obp', key: 'start_year', value: '1890', quote: 'It was 1890 when the system started' },
  { id: 'c3', sourceId: 'wp', key: 'founding_men', value: 'about 100', quote: 'with about a hundred men' },
  { id: 'c4', sourceId: 'obp', key: 'founding_men', value: '50-60', quote: 'started with fifty-sixty people' },
  { id: 'c5', sourceId: 'wp', key: 'boxes_per_day', value: '175000-200000', quote: 'between 175,000 and 200,000' },
  { id: 'c6', sourceId: 'mirror', key: 'boxes_per_day', value: '175000-200000', quote: 'between 175,000 and 200,000' },
];
describe('claim ledger', () => {
  const g = Object.fromEntries(classifyClaims(sources, claims).map((x) => [x.key, x.status]));
  it('two independent sources agreeing is central', () => expect(g.start_year).toBe('central'));
  it('independent sources that differ are disputed', () => expect(g.founding_men).toBe('disputed'));
  it('a mirror of the same origin does not count as independent', () => expect(g.boxes_per_day).toBe('single'));
  it('phrasing rules follow status', () => { expect(allowedPhrasing('central')).toBe('plain'); expect(allowedPhrasing('single')).toBe('attributed'); expect(allowedPhrasing('disputed')).toBe('disagreement_only'); });
  it('ignores claims from unknown sources', () => expect(classifyClaims(sources, [{ id: 'x', sourceId: 'nope', key: 'k', value: 'v', quote: 'q' }])).toEqual([]));
  it('licence flags never claim clearance', () => { expect(licenceFlags(sources, ['wp']).join()).toMatch(/share-alike/); expect(licenceFlags(sources, ['guardian']).join()).toMatch(/never copied wording/); });
});
describe('rejections, pool, spend', () => {
  it('counts acceptance and reasons', () => { const o = [{ ok: true as const }, { ok: false as const, reason: 'repeated_fact' as const }, { ok: false as const, reason: 'repeated_fact' as const }]; expect(acceptanceRate(o)).toBeCloseTo(1 / 3); expect(rejectionCounts(o)).toEqual({ repeated_fact: 2 }); expect(acceptanceRate([])).toBeNull(); });
  it('pool states are explicit', () => { expect(poolState({ published: 0, lowWater: 5, capReached: false })).toBe('empty'); expect(poolState({ published: 0, lowWater: 5, capReached: true })).toBe('paused_cap'); expect(poolState({ published: 3, lowWater: 5, capReached: false })).toBe('low'); expect(poolState({ published: 9, lowWater: 5, capReached: false })).toBe('healthy'); });
  it('monthly cap is hard and resets by month', () => { let m = { month: '2026-10', reservedMicro: 0 }; let r = tryReserve(m, '2026-10', 600_000, 1_000_000); expect(r.ok).toBe(true); m = r.next; r = tryReserve(m, '2026-10', 500_000, 1_000_000); expect(r.ok).toBe(false); expect(r.next.reservedMicro).toBe(600_000); r = tryReserve(m, '2026-11', 500_000, 1_000_000); expect(r.ok).toBe(true); expect(tryReserve(m, '2026-10', 0, 1_000_000).ok).toBe(false); });
});
describe('cost forecast', () => {
  const base = { tokensIn: 49_000, tokensOut: 10_500, retryFactor: 1.5, sourceFactor: 3, acceptance: 1 / 3, writer: { inPerM: 0.1, outPerM: 0.5 }, judge: { inPerM: 2, outPerM: 10 }, judgeShare: 0.5 };
  it('divides by acceptance', () => { const hi = costPerAcceptedUsd(base); const lo = costPerAcceptedUsd({ ...base, acceptance: 2 / 3 }); expect(hi / lo).toBeCloseTo(2); });
  it('lower acceptance never lowers cost', () => expect(costPerAcceptedUsd({ ...base, acceptance: 0.1 })).toBeGreaterThan(costPerAcceptedUsd(base)));
  it('zero acceptance is unbounded, not zero', () => expect(costPerAcceptedUsd({ ...base, acceptance: 0 })).toBe(Infinity));
});
describe('access policy is separate from generation', () => {
  it('today: one new per day for everyone', () => { expect(canOpenNew(CURRENT_POLICY, false, 0).allowed).toBe(true); expect(canOpenNew(CURRENT_POLICY, false, 1).allowed).toBe(false); });
  it('N per day and on-demand are config changes', () => { expect(canOpenNew({ mode: 'per_day', perDay: 3, audience: 'all' }, false, 2).allowed).toBe(true); expect(canOpenNew({ mode: 'on_demand', audience: 'all' }, false, 50).allowed).toBe(true); });
  it('creator-only on-demand blocks others', () => { expect(canOpenNew({ mode: 'on_demand', audience: 'creator' }, false, 0).allowed).toBe(false); expect(canOpenNew({ mode: 'on_demand', audience: 'creator' }, true, 99).allowed).toBe(true); });
});
import { worksheet, DEFAULT, PROVISIONAL, DEFAULT_STAGES } from '../src/gen/cost';
import { worstCaseMicro, reserveCall, settleCall } from '../src/gen/ledger';
describe('cost worksheet', () => {
  it('applies acceptance exactly once', () => { const a = worksheet(DEFAULT), b = worksheet({ ...DEFAULT, acceptance: 2 / 3 }); expect(a.attemptUsd).toBeCloseTo(b.attemptUsd, 10); expect(a.perAcceptedUsd / b.perAcceptedUsd).toBeCloseTo(2); expect(a.perAcceptedUsd).toBeCloseTo(a.attemptUsd * 3); });
  it('thinking bills as output and search is separate', () => { const base = worksheet(DEFAULT); const th = worksheet({ ...DEFAULT, stages: DEFAULT_STAGES.map((s) => ({ ...s, thinkingOutPerCall: 2000 })) }); expect(th.attemptUsd).toBeGreaterThan(base.attemptUsd * 1.5); const se = worksheet({ ...DEFAULT, search: { count: 5, usdPerThousand: 10 } }); expect(se.searchUsd).toBeCloseTo(0.05); expect(se.attemptUsd - base.attemptUsd).toBeCloseTo(0.05); });
  it('batch discounts tokens but not search', () => { const s = { ...DEFAULT, search: { count: 5, usdPerThousand: 10 } }; const full = worksheet(s), half = worksheet({ ...s, batchDiscount: 0.5 }); expect(half.attemptUsd - half.searchUsd).toBeCloseTo((full.attemptUsd - full.searchUsd) / 2); expect(half.searchUsd).toBe(full.searchUsd); });
  it('retries inside a stage raise attempt cost, not acceptance', () => { const hi = worksheet({ ...DEFAULT, stages: DEFAULT_STAGES.map((s) => ({ ...s, stageRetryFactor: s.stageRetryFactor * 2 })) }); expect(hi.attemptUsd).toBeGreaterThan(worksheet(DEFAULT).attemptUsd * 1.9); expect(hi.acceptance).toBe(worksheet(DEFAULT).acceptance); });
  it('zero acceptance is infinite', () => expect(worksheet({ ...DEFAULT, acceptance: 0 }).perAcceptedUsd).toBe(Infinity));
  it('provisional rates are the only rate source', () => expect(DEFAULT.writer).toEqual(PROVISIONAL.writer));
});
describe('hard cap', () => {
  const spec = { inRatePerM: 2, outRatePerM: 10, promptBytes: 10_000, maxTokens: 1_000, maxSearches: 2, usdPerThousandSearches: 10 };
  it('reserves thinking (inside max_tokens) and searches', () => { expect(worstCaseMicro(spec)).toBe(10_000 * 2 + 1_000 * 10 + 2 * 10 * 1000); expect(worstCaseMicro({ ...spec, maxSearches: 0 })).toBe(30_000); });
  it('concurrent reservations all count, in order', () => { let s = { capMicro: 100_000, reservations: [], paused: false } as any; const a = reserveCall(s, 'a', '2026-10', 60_000); s = a.state; const b = reserveCall(s, 'b', '2026-10', 60_000); expect(a.ok).toBe(true); expect(b.ok).toBe(false); expect(b.reason).toBe('over_cap'); });
  it('failed calls keep their reservation, a smaller actual frees nothing', () => { let s = reserveCall({ capMicro: 100_000, reservations: [], paused: false }, 'a', '2026-10', 80_000).state; s = settleCall(s, 'a', 0); expect(reserveCall(s, 'b', '2026-10', 30_000).ok).toBe(false); });
  it('an overage pauses generation', () => { let s = reserveCall({ capMicro: 100_000, reservations: [], paused: false }, 'a', '2026-10', 10_000).state; s = settleCall(s, 'a', 25_000); expect(s.paused).toBe(true); expect(reserveCall(s, 'b', '2026-10', 1).reason).toBe('paused'); });
  it('month rollover starts a fresh month, old month stays counted', () => { let s = reserveCall({ capMicro: 100_000, reservations: [], paused: false }, 'a', '2026-10', 90_000).state; expect(reserveCall(s, 'b', '2026-10', 20_000).ok).toBe(false); s = reserveCall(s, 'c', '2026-11', 90_000).state; expect(s.reservations.length).toBe(2); });
  it('duplicate id and zero amount are refused', () => { const s = reserveCall({ capMicro: 100, reservations: [], paused: false }, 'a', 'm', 10).state; expect(reserveCall(s, 'a', 'm', 10).reason).toBe('duplicate'); expect(reserveCall(s, 'z', 'm', 0).reason).toBe('bad_amount'); });
});
