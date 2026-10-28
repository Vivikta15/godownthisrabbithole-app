import { describe, it, expect } from 'vitest';
import { decide, canaryOk, pilotPasses, type Health } from '../src/gen/controller';
const ok: Health = { canaryOk: true, canaryAgeDays: 1, cap: 'ok', providerFailuresInRow: 0, attempts7d: 30, accepted7d: 10, published: 3, targetPool: 14, lowWater: 5, maxAttemptsPerDay: 12, flaggedHeld: 0, killSwitch: false };
describe('daily controller (logic only; says nothing about story quality)', () => {
  it('refills toward target using measured acceptance, bounded per day', () => { const d = decide(ok); expect(d.generateAttempts).toBe(12); expect(d.autoPublish).toBe(true); expect(d.alerts).toEqual(['pool_low']); });
  it('generates nothing when the pool is full', () => expect(decide({ ...ok, published: 14 }).generateAttempts).toBe(0));
  it('failed canary stops generation and publishing', () => { const d = decide({ ...ok, canaryOk: false }); expect(d.generateAttempts).toBe(0); expect(d.autoPublish).toBe(false); expect(d.alerts).toContain('judge_canary_failed'); });
  it('stale or missing canary asks for a canary first', () => { expect(decide({ ...ok, canaryAgeDays: 9 }).runCanaryFirst).toBe(true); expect(decide({ ...ok, canaryAgeDays: null }).runCanaryFirst).toBe(true); expect(decide(ok).runCanaryFirst).toBe(false); });
  it('cap exhausted holds generation but the existing pool keeps publishing', () => { const d = decide({ ...ok, cap: 'exhausted' }); expect(d.generateAttempts).toBe(0); expect(d.autoPublish).toBe(true); expect(d.alerts).toContain('cap_exhausted'); });
  it('an overage pauses publishing too', () => { const d = decide({ ...ok, cap: 'paused_overage' }); expect(d.autoPublish).toBe(false); expect(d.generateAttempts).toBe(0); });
  it('collapsed acceptance stops spend instead of retrying harder', () => { const d = decide({ ...ok, attempts7d: 40, accepted7d: 2 }); expect(d.generateAttempts).toBe(0); expect(d.alerts).toContain('acceptance_collapsed'); });
  it('repeated provider failure holds and alerts', () => { const d = decide({ ...ok, providerFailuresInRow: 3 }); expect(d.generateAttempts).toBe(0); expect(d.alerts).toContain('provider_failing'); });
  it('kill switch stops everything new', () => { const d = decide({ ...ok, killSwitch: true }); expect(d.autoPublish).toBe(false); expect(d.generateAttempts).toBe(0); });
  it('empty pool is an explicit alert, never hidden', () => expect(decide({ ...ok, published: 0, cap: 'exhausted' }).alerts).toEqual(expect.arrayContaining(['pool_empty', 'cap_exhausted'])));
  it('alerts are deduped', () => { const a = decide({ ...ok, published: 0 }).alerts; expect(new Set(a).size).toBe(a.length); });
});
describe('canary and go-live gate', () => {
  const mk = (n: number, falseAccept = 0) => Array.from({ length: n }, (_, i) => ({ corrupted: true, accepted: i < falseAccept }));
  it('canary needs enough corrupted cases and zero false accepts', () => { expect(canaryOk(mk(5)).reason).toBe('canary_too_small'); expect(canaryOk(mk(24, 1)).reason).toBe('false_accept'); expect(canaryOk(mk(24)).ok).toBe(true); });
  const good = { attempts: 12, accepted: 5, injectedErrorStories: 12, injectedAccepted: 0, spentMicro: 2_000_000, capMicro: 3_000_000, goldComparisonPassed: 2, goldComparisonTotal: 2 };
  it('pilot passes only when every threshold is met', () => { expect(pilotPasses(good).pass).toBe(true); expect(pilotPasses({ ...good, injectedAccepted: 1 }).failures).toContain('accepted_a_story_with_an_injected_error'); expect(pilotPasses({ ...good, accepted: 1 }).failures).toContain('acceptance_below_20pct'); expect(pilotPasses({ ...good, spentMicro: 4_000_000 }).failures).toContain('over_cap'); expect(pilotPasses({ ...good, goldComparisonPassed: 1 }).failures).toContain('gold_claims_not_all_reproduced'); });
});
