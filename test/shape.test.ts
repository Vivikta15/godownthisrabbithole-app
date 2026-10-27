import { describe, it, expect } from 'vitest';
import { shapeBeats } from '../src/shared/shape';
const b = [{ q: '1', a: 'a' }, { q: '2', a: 'b' }, { q: '3', a: 'c' }];
describe('shapeBeats', () => {
  it('short keeps first and last beat whole', () => { expect(shapeBeats(b, 'short')).toEqual([b[0], b[2]]); });
  it('medium, null and unknown keep all', () => { for (const l of ['medium', null, undefined, 'x']) expect(shapeBeats(b, l as any)).toEqual(b); });
  it('short leaves two-beat stories alone', () => { expect(shapeBeats(b.slice(0, 2), 'short')).toHaveLength(2); });
});
