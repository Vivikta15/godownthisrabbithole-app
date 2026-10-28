// Unattended daily controller: decides what a scheduled run may do. Pure; preparation only, not wired, no paid calls.
// Principle: failure holds work and raises ONE alert key. It never lowers a quality gate to keep the pool full.
export type Health = {
  canaryOk: boolean; canaryAgeDays: number | null;      // judge canary: known-bad claims must ALL be rejected. null = never run
  cap: 'ok' | 'exhausted' | 'paused_overage';           // from the hard-cap ledger
  providerFailuresInRow: number;                        // consecutive provider/model errors (incl. model not found)
  attempts7d: number; accepted7d: number;               // measured, not assumed
  published: number; targetPool: number; lowWater: number; // ready stories vs desired reserve
  maxAttemptsPerDay: number;                            // spend-shaping limit, separate from the dollar cap
  flaggedHeld: number;                                  // published stories pulled back for recheck (reader flag, source revision changed)
  killSwitch: boolean;                                  // owner's one-message pause
};
export type Decision = { runCanaryFirst: boolean; generateAttempts: number; autoPublish: boolean; alerts: string[] };
export const CANARY_MAX_AGE_DAYS = 7; export const MIN_ATTEMPTS_FOR_RATE = 10; export const MIN_ACCEPTANCE = 0.1;

export function decide(h: Health): Decision {
  const alerts: string[] = []; let generate = 0; let publish = !h.killSwitch;
  const runCanaryFirst = h.canaryAgeDays === null || h.canaryAgeDays > CANARY_MAX_AGE_DAYS;
  if (h.killSwitch) alerts.push('kill_switch_on');
  if (!h.canaryOk) { publish = false; alerts.push('judge_canary_failed'); }               // cannot trust the judge: generate nothing, publish nothing new
  if (h.cap === 'paused_overage') { publish = false; alerts.push('cap_overage_paused'); }
  if (h.cap === 'exhausted') alerts.push('cap_exhausted');
  if (h.providerFailuresInRow >= 3) alerts.push('provider_failing');
  const rate = h.attempts7d >= MIN_ATTEMPTS_FOR_RATE ? h.accepted7d / h.attempts7d : null;
  const lowYield = rate !== null && rate < MIN_ACCEPTANCE; if (lowYield) alerts.push('acceptance_collapsed');
  const blocked = h.killSwitch || !h.canaryOk || h.cap !== 'ok' || h.providerFailuresInRow >= 3 || lowYield;
  if (!blocked && h.published < h.targetPool) {
    const assumed = Math.max(rate ?? 1 / 3, MIN_ACCEPTANCE); generate = Math.min(h.maxAttemptsPerDay, Math.ceil((h.targetPool - h.published) / assumed));
  }
  if (h.published <= 0) alerts.push('pool_empty'); else if (h.published < h.lowWater) alerts.push('pool_low');
  return { runCanaryFirst, generateAttempts: generate, autoPublish: publish, alerts: [...new Set(alerts)] };
}

// Canary: corrupted claims the judge must refuse. Any false accept pauses publishing until a person or a model change fixes it. Rerun on every model or prompt change.
export function canaryOk(results: { corrupted: boolean; accepted: boolean }[], minCorrupted = 20): { ok: boolean; reason?: string } {
  const bad = results.filter((r) => r.corrupted); if (bad.length < minCorrupted) return { ok: false, reason: 'canary_too_small' };
  return bad.some((r) => r.accepted) ? { ok: false, reason: 'false_accept' } : { ok: true };
}
// Go-live gate for the system-run pilot: autonomous publishing stays OFF unless every threshold is met.
export type PilotResult = { attempts: number; accepted: number; injectedErrorStories: number; injectedAccepted: number; spentMicro: number; capMicro: number; goldComparisonPassed: number; goldComparisonTotal: number };
export function pilotPasses(r: PilotResult): { pass: boolean; failures: string[] } {
  const f: string[] = [];
  if (r.attempts < 10) f.push('too_few_attempts');
  if (r.attempts > 0 && r.accepted / r.attempts < 0.2) f.push('acceptance_below_20pct');
  if (r.injectedErrorStories < 10) f.push('too_few_injected_errors'); if (r.injectedAccepted > 0) f.push('accepted_a_story_with_an_injected_error');
  if (r.spentMicro > r.capMicro) f.push('over_cap');
  if (r.goldComparisonTotal < 2 || r.goldComparisonPassed < r.goldComparisonTotal) f.push('gold_claims_not_all_reproduced');
  return { pass: f.length === 0, failures: f };
}
