import { describe, it, expect } from 'vitest';
import { shapeBeats } from '../src/shared/shape';
import { SEED } from '../src/content/seed';
const b = [{ q: '1', a: 'a' }, { q: '2', a: 'b' }, { q: '3', a: 'c' }];
describe('shapeBeats', () => {
  it('short uses only the author-listed beats, whole', () => { expect(shapeBeats(b, 'short', [0, 2])).toEqual([b[0], b[2]]); });
  it('no shortKeep means full story (no generic truncation)', () => { expect(shapeBeats(b, 'short')).toEqual(b); });
  it('medium, null and unknown keep all', () => { for (const l of ['medium', null, undefined, 'x']) expect(shapeBeats(b, l as any, [0])).toEqual(b); });
  it('invalid keep lists fall back to the full story', () => { for (const k of [[5], [0, 0], [0, 1, 2], [-1]]) expect(shapeBeats(b, 'short', k)).toEqual(b); });
  it('seed shortKeep entries are valid for their stories', () => { for (const t of SEED) if (t.shortKeep) expect(shapeBeats(t.beats, 'short', t.shortKeep).length).toBe(t.shortKeep.length); });
});
