import { PLANS, TRIAL_DAYS, type PlanId } from './config';

export interface Account {
  signupAt: Date;
  paidPlan: 'plan3' | 'plan5' | null;
  subscriptionStatus: 'none' | 'active' | 'past_due' | 'cancelled'; // set ONLY by verified Dodo webhooks
  paidThrough: Date | null;
}
export interface Access { plan: PlanId | 'expired' | 'creator'; rabbitHoles: boolean; finderQuota: { period: 'day' | 'week'; limit: number } | null; trialEndsAt: Date; }

export function trialEnd(signupAt: Date): Date { return new Date(signupAt.getTime() + TRIAL_DAYS * 86400000); }

export function accessFor(a: Account, now: Date, creator = false): Access {
  if (creator) return { plan: 'creator', rabbitHoles: true, finderQuota: null, trialEndsAt: trialEnd(a.signupAt) };
  const trialEndsAt = trialEnd(a.signupAt);
  const paidActive = a.paidPlan !== null && (a.subscriptionStatus === 'active' || ((a.subscriptionStatus === 'cancelled' || a.subscriptionStatus === 'past_due') && a.paidThrough !== null && a.paidThrough > now));
  if (paidActive && a.paidPlan) {
    const p = PLANS[a.paidPlan];
    return { plan: a.paidPlan, rabbitHoles: p.rabbit_holes, finderQuota: p.connection_finder, trialEndsAt };
  }
  if (now < trialEndsAt) return { plan: 'trial', rabbitHoles: true, finderQuota: PLANS.trial.connection_finder, trialEndsAt };
  return { plan: 'expired', rabbitHoles: false, finderQuota: null, trialEndsAt };
}

export function finderUsesAllowed(q: Access['finderQuota'], usesInPeriod: number, creator = false): boolean {
  if (creator) return true;
  return q !== null && usesInPeriod < q.limit;
}
