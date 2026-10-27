// Preference signals, not "learning styles": we only claim what behaviour shows.
export interface Topic { id: string; tags: string[]; formats: string[] }
export interface ReadEvent { topicTags: string[]; format: string; secondsRead: number; completed: boolean; day: string }
export interface Profile { interestTags: string[]; formats: string[]; }

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

export function affinity(events: ReadEvent[], profile: Profile) {
  const tag = new Map<string, number>(); const fmt = new Map<string, number>();
  for (const t of profile.interestTags) tag.set(t, 0.5);
  for (const f of profile.formats) fmt.set(f, 0.5);
  for (const e of events) {
    const w = (e.completed ? 1 : 0.3) * clamp(e.secondsRead / 300);
    for (const t of e.topicTags) tag.set(t, (tag.get(t) ?? 0) + w);
    fmt.set(e.format, (fmt.get(e.format) ?? 0) + w);
  }
  return { tag, fmt };
}

/** Pick tomorrow's topic: affinity x novelty, minus recently seen; every 4th pick explores a low-affinity tag. */
export function pickTopic(cands: Topic[], seenIds: string[], events: ReadEvent[], profile: Profile, explore = false) {
  const { tag, fmt } = affinity(events, profile);
  const fresh = cands.filter((c) => !seenIds.includes(c.id));
  if (fresh.length === 0) return null;
  const seenTags = new Set(events.slice(-5).flatMap((e) => e.topicTags));
  const scored = fresh.map((c) => {
    const a = c.tags.reduce((s, t) => s + (tag.get(t) ?? 0), 0) / Math.max(1, c.tags.length);
    const novelty = c.tags.some((t) => !seenTags.has(t)) ? 0.3 : 0;
    const bestFmt = Math.max(0, ...c.formats.map((f) => fmt.get(f) ?? 0));
    return { topic: c, score: a + novelty + 0.2 * bestFmt, format: c.formats.slice().sort((x, y) => (fmt.get(y) ?? 0) - (fmt.get(x) ?? 0))[0] };
  }).sort((x, y) => y.score - x.score || x.topic.id.localeCompare(y.topic.id));
  return explore ? scored[scored.length - 1] : scored[0];
}
