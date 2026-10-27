import { describe, it, expect } from 'vitest';
import { mapSubscriptionEvent } from '../src/worker/billing';
import { accessFor } from '../src/shared/entitlements';
const ev = (type: string, extra: any = {}, meta: any = { user_id: 'u1', plan: 'plan3' }) => ({ type, data: { payload_type: 'Subscription', subscription_id: 'sub_1', next_billing_date: '2026-12-01T00:00:00Z', metadata: meta, ...extra } });
describe('mapSubscriptionEvent', () => {
  it('active grants paid plan until next billing date', () => { const u = mapSubscriptionEvent(ev('subscription.active', { status: 'active' }))!; expect(u.status).toBe('active'); expect(u.paidThrough).toBe(Date.parse('2026-12-01T00:00:00Z')); });
  it('ignores events without our metadata or with unknown plan', () => { expect(mapSubscriptionEvent(ev('subscription.active', {}, {}))).toBeNull(); expect(mapSubscriptionEvent(ev('subscription.active', {}, { user_id: 'u1', plan: 'trial' }))).toBeNull(); expect(mapSubscriptionEvent(ev('subscription.active', {}, { user_id: 'u1', plan: 'constructor' }))).toBeNull(); });
  it('non-subscription events ignored', () => { expect(mapSubscriptionEvent({ type: 'payment.succeeded', data: { payload_type: 'Payment' } })).toBeNull(); });
  it('updated with non-active status does not grant access', () => { expect(mapSubscriptionEvent(ev('subscription.updated', { status: 'on_hold' }))!.status).toBe('cancelled'); });
  it('on_hold/failed/expired end access immediately; cancelled keeps paid period', () => { expect(mapSubscriptionEvent(ev('subscription.on_hold'))!.paidThrough).toBeNull(); expect(mapSubscriptionEvent(ev('subscription.cancelled'))!.paidThrough).not.toBeNull(); });
  it('past_due keeps access only until the grace deadline', () => {
    const u = mapSubscriptionEvent(ev('subscription.past_due', { past_due_ends_at: '2026-11-03T00:00:00Z' }))!;
    const acct = (now: string) => accessFor({ signupAt: new Date('2026-01-01'), paidPlan: u.plan, subscriptionStatus: u.status, paidThrough: new Date(u.paidThrough!) }, new Date(now)).plan;
    expect(acct('2026-11-02T00:00:00Z')).toBe('plan3'); expect(acct('2026-11-04T00:00:00Z')).toBe('expired');
  });
});
