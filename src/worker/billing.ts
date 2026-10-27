// Maps verified Dodo subscription webhook events to our subscription row.
// Event names and fields are from docs.dodopayments.com webhook pages (checked 2026-10-27); re-check before live.
// The user and plan come from checkout metadata WE set (user_id, plan). Missing or unknown metadata = ignore the event.
import { PLANS } from '../shared/config';

export type SubStatus = 'active' | 'past_due' | 'cancelled';
export interface SubUpdate { userId: string; plan: 'plan3' | 'plan5'; status: SubStatus; paidThrough: number | null; dodoSubscriptionId: string | null }

const ACTIVE = new Set(['subscription.active', 'subscription.renewed', 'subscription.plan_changed', 'subscription.updated', 'subscription.unpaused']);
const ENDED = new Set(['subscription.cancelled', 'subscription.expired', 'subscription.failed', 'subscription.on_hold', 'subscription.paused']);

const ms = (v: unknown): number | null => { if (typeof v !== 'string') return null; const t = Date.parse(v); return Number.isFinite(t) ? t : null; };

export function mapSubscriptionEvent(ev: any): SubUpdate | null {
  const type = String(ev?.type ?? '');
  const d = ev?.data;
  if (!type.startsWith('subscription.') || !d || d.payload_type !== 'Subscription') return null;
  const userId = d.metadata?.user_id; const plan = d.metadata?.plan;
  if (typeof userId !== 'string' || !userId || (plan !== 'plan3' && plan !== 'plan5') || !(plan in PLANS)) return null;
  const base = { userId, plan, dodoSubscriptionId: typeof d.subscription_id === 'string' ? d.subscription_id : null } as const;
  const next = ms(d.next_billing_date);
  if (type === 'subscription.past_due') return { ...base, status: 'past_due', paidThrough: ms(d.past_due_ends_at) };
  if (ACTIVE.has(type)) {
    // updated/unpaused can carry a non-active status: only grant access when the payload itself says active.
    if (typeof d.status === 'string' && d.status !== 'active') return { ...base, status: 'cancelled', paidThrough: null };
    return { ...base, status: 'active', paidThrough: next };
  }
  if (ENDED.has(type)) {
    // user-cancelled keeps access until the period they paid for ends; failures/holds do not.
    return { ...base, status: 'cancelled', paidThrough: type === 'subscription.cancelled' ? next : null };
  }
  return null;
}
