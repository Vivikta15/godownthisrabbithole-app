// Interim length adaptation for hand-written sample stories (they are not written in length variants).
// 'short' keeps the opening beat and the payoff (last beat); 'medium' or unknown keeps everything.
// Real variants will come from the generator, each source-checked on its own. Never cut text inside a beat.
export type Beat = { q: string; a: string };
export function shapeBeats(beats: Beat[], length: string | null | undefined): Beat[] {
  if (length === 'short' && beats.length > 2) return [beats[0], beats[beats.length - 1]];
  return beats;
}
