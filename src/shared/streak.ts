// Streak math on calendar days in the user's timezone ("YYYY-MM-DD" strings).
export interface StreakState {
  current: number;
  longest: number;
  lastReadDay: string | null; // last day with a completed read
  freezesLeft: number;
}

export function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function localDay(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export interface CompleteResult { state: StreakState; freezesUsed: number; reset: boolean; alreadyCounted: boolean }

/** Record a completed read on `today`. Missed days in between spend freezes (one per missed day) if available; otherwise the streak restarts at 1. */
export function recordRead(prev: StreakState, today: string): CompleteResult {
  if (prev.lastReadDay === today) return { state: prev, freezesUsed: 0, reset: false, alreadyCounted: true };
  if (prev.lastReadDay === null) {
    const s = { ...prev, current: 1, longest: Math.max(prev.longest, 1), lastReadDay: today };
    return { state: s, freezesUsed: 0, reset: false, alreadyCounted: false };
  }
  const gap = dayDiff(prev.lastReadDay, today);
  if (gap < 1) return { state: prev, freezesUsed: 0, reset: false, alreadyCounted: true }; // clock skew / past date
  const missed = gap - 1;
  if (missed <= prev.freezesLeft) {
    const current = prev.current + 1;
    return { state: { current, longest: Math.max(prev.longest, current), lastReadDay: today, freezesLeft: prev.freezesLeft - missed }, freezesUsed: missed, reset: false, alreadyCounted: false };
  }
  return { state: { current: 1, longest: Math.max(prev.longest, 1), lastReadDay: today, freezesLeft: prev.freezesLeft }, freezesUsed: 0, reset: true, alreadyCounted: false };
}

/** Streak value to display on `today` without mutating: a streak that is already unrecoverable shows 0. */
export function displayStreak(s: StreakState, today: string): number {
  if (s.lastReadDay === null) return 0;
  const missed = dayDiff(s.lastReadDay, today) - 1;
  return missed <= s.freezesLeft ? s.current : 0;
}
