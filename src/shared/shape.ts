// Interim length adaptation for hand-written sample stories.
// A story gets a short version ONLY if its author listed which beats stand on their own (shortKeep, indexes in order).
// Generic truncation breaks stories (later beats refer to terms or qualifications introduced earlier), so without shortKeep the full story is shown.
// Real length variants will come from the generator, each source-checked on its own. Never cut text inside a beat.
export type Beat = { q: string; a: string };
export function shapeBeats(beats: Beat[], length: string | null | undefined, shortKeep?: number[]): Beat[] {
  if (length !== 'short' || !shortKeep || shortKeep.length === 0) return beats;
  const idx = [...new Set(shortKeep)].filter((i) => Number.isInteger(i) && i >= 0 && i < beats.length).sort((a, b) => a - b);
  return idx.length === shortKeep.length && idx.length < beats.length ? idx.map((i) => beats[i]) : beats;
}
