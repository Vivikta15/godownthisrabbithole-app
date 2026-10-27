import { describe, it, expect } from 'vitest';
import { recordRead, displayStreak, dayDiff, localDay } from '../src/shared/streak';
import { accessFor, finderUsesAllowed } from '../src/shared/entitlements';
import { pickTopic } from '../src/shared/recommend';
import { nextMascot } from '../src/shared/mascot';

const s0 = { current: 0, longest: 0, lastReadDay: null, freezesLeft: 2 };
describe('streak', () => {
  it('starts and increments', () => {
    const a = recordRead(s0, '2026-10-27'); expect(a.state.current).toBe(1);
    expect(recordRead(a.state, '2026-10-28').state.current).toBe(2);
  });
  it('same day does not double count', () => {
    const a = recordRead(s0, '2026-10-27'); expect(recordRead(a.state, '2026-10-27').alreadyCounted).toBe(true);
  });
  it('freeze covers a missed day', () => {
    const a = recordRead(s0, '2026-10-27'); const b = recordRead(a.state, '2026-10-29');
    expect(b.freezesUsed).toBe(1); expect(b.state.current).toBe(2); expect(b.state.freezesLeft).toBe(1);
  });
  it('resets without enough freezes', () => {
    const a = recordRead({ ...s0, freezesLeft: 1 }, '2026-10-27'); const b = recordRead(a.state, '2026-11-01');
    expect(b.reset).toBe(true); expect(b.state.current).toBe(1);
  });
  it('display shows 0 when unrecoverable, month boundary diff', () => {
    expect(dayDiff('2026-10-31', '2026-11-01')).toBe(1);
    expect(displayStreak({ current: 5, longest: 5, lastReadDay: '2026-10-20', freezesLeft: 1 }, '2026-10-27')).toBe(0);
  });
  it('local day respects timezone', () => {
    expect(localDay(new Date('2026-10-27T20:00:00Z'), 'Asia/Calcutta')).toBe('2026-10-28');
  });
});
describe('entitlements', () => {
  const signupAt = new Date('2026-10-27T00:00:00Z');
  it('trial then expired', () => {
    const a = { signupAt, paidPlan: null, subscriptionStatus: 'none' as const, paidThrough: null };
    expect(accessFor(a, new Date('2026-10-29T00:00:00Z')).plan).toBe('trial');
    const e = accessFor(a, new Date('2026-10-31T00:00:00Z')); expect(e.plan).toBe('expired'); expect(e.rabbitHoles).toBe(false);
  });
  it('active plan3 gets weekly finder quota', () => {
    const a = { signupAt, paidPlan: 'plan3' as const, subscriptionStatus: 'active' as const, paidThrough: null };
    const x = accessFor(a, new Date('2026-12-01T00:00:00Z')); expect(x.finderQuota).toEqual({ period: 'week', limit: 2 });
    expect(finderUsesAllowed(x.finderQuota, 2)).toBe(false);
  });
  it('past_due does not grant paid access after trial', () => {
    const a = { signupAt, paidPlan: 'plan5' as const, subscriptionStatus: 'past_due' as const, paidThrough: null };
    expect(accessFor(a, new Date('2026-12-01T00:00:00Z')).plan).toBe('expired');
  });
});
describe('recommend', () => {
  it('prefers topics matching completed reads and skips seen', () => {
    const cands = [{ id: 'a', tags: ['space'], formats: ['story'] }, { id: 'b', tags: ['food'], formats: ['story'] }, { id: 'c', tags: ['space'], formats: ['story'] }];
    const ev = [{ topicTags: ['space'], format: 'story', secondsRead: 300, completed: true, day: '2026-10-26' }];
    const p = pickTopic(cands, ['a'], ev, { interestTags: ['food'], formats: ['story'] });
    expect(p?.topic.id).toBe('c');
  });
});
describe('mascot', () => {
  it('read cycle', () => {
    let s = nextMascot('idle', 'read_start'); expect(s).toBe('hop_in');
    s = nextMascot(s, 'animation_done'); expect(s).toBe('reading');
    expect(nextMascot(s, 'tab_change_other')).toBe('reading');
    s = nextMascot(s, 'read_finish'); expect(s).toBe('hop_out');
    expect(nextMascot(s, 'animation_done')).toBe('cheer');
  });
});
