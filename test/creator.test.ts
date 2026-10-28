import { describe, it, expect } from 'vitest';
import { accessFor, finderUsesAllowed } from '../src/shared/entitlements';
const expired = { signupAt: new Date('2026-01-01'), paidPlan: null, subscriptionStatus: 'none' as const, paidThrough: null };
describe('creator access', () => {
  it('is off by default: an expired trial stays expired', () => {
    const a = accessFor(expired, new Date('2026-10-28'));
    expect(a.plan).toBe('expired'); expect(a.rabbitHoles).toBe(false); expect(finderUsesAllowed(a.finderQuota, 0)).toBe(false);
  });
  it('lifts trial expiry and Finder quota only when the creator flag is passed', () => {
    const a = accessFor(expired, new Date('2026-10-28'), true);
    expect(a.plan).toBe('creator'); expect(a.rabbitHoles).toBe(true); expect(finderUsesAllowed(a.finderQuota, 999, true)).toBe(true);
    expect(finderUsesAllowed(a.finderQuota, 0)).toBe(false);
  });
});
