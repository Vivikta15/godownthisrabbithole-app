// Product rules that are NOT final. Every undecided value is null/explicit so nothing is silently baked in.
export type PlanId = 'trial' | 'plan3' | 'plan5';

export interface PlanRules {
  price_usd: number | null;
  billing: 'monthly' | 'yearly' | null; // paid plans: monthly, confirmed by the user 2026-10-27 (WhatsApp "Yes")
  streak_freezes: number | null; // OPEN for plan3 (brief: "to be finalized")
  connection_finder: { period: 'day' | 'week'; limit: number };
  rabbit_holes: boolean;
}

export const TRIAL_DAYS = 3;

export const PLANS: Record<PlanId, PlanRules> = {
  trial: { price_usd: 0, billing: null, streak_freezes: 2, connection_finder: { period: 'day', limit: 1 }, rabbit_holes: true },
  plan3: { price_usd: 3, billing: 'monthly', streak_freezes: null, connection_finder: { period: 'week', limit: 2 }, rabbit_holes: true },
  plan5: { price_usd: 5, billing: 'monthly', streak_freezes: 5, connection_finder: { period: 'day', limit: 1 }, rabbit_holes: true },
};

// OPEN: what happens when a day is missed and no freeze is left. Not decided by the user.
export type UnprotectedMissPolicy = 'reset'; // add other policies only after the user decides
export const STREAK_POLICY = { onUnprotectedMiss: 'reset' as UnprotectedMissPolicy };
