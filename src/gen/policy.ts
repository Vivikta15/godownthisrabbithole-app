// Access policy is separate from generation: how many stories a person may open, and who. Preparation only, not wired.
// The product today is { mode: 'daily', audience: 'all' }. Changing it must not require touching the generator.
export type Audience = 'creator' | 'all';
export type AccessPolicy = { mode: 'daily' | 'per_day' | 'on_demand'; perDay?: number; audience: Audience };
export const CURRENT_POLICY: AccessPolicy = { mode: 'daily', audience: 'all' };
export function canOpenNew(p: AccessPolicy, isCreator: boolean, openedToday: number): { allowed: boolean; reason?: string } {
  if (p.audience === 'creator' && !isCreator && p.mode === 'on_demand') return { allowed: false, reason: 'on-demand is creator-only' };
  const limit = p.mode === 'daily' ? 1 : p.mode === 'per_day' ? Math.max(1, p.perDay ?? 1) : Infinity;
  return openedToday < limit ? { allowed: true } : { allowed: false, reason: `limit of ${limit} new per day reached` };
}
