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
