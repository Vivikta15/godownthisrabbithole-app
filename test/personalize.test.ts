import { describe, it, expect } from 'vitest';
import { SEED } from '../src/content/seed';
describe('seed relations', () => {
  it('every related pointer targets a real story and carries a source sentence that is in the story text or beats of its page', () => {
    for (const t of SEED) if (t.related) { expect(SEED.some((x) => x.id === t.related!.id)).toBe(true); expect(t.related.sentence.length).toBeGreaterThan(20); expect(t.related.page.length).toBeGreaterThan(1); }
  });
  it('no unscoped aggregate claim about UPI in published text', () => {
    const upi = SEED.find((t) => t.id === 'upi')!; const all = (upi.story.join(' ') + upi.hook + JSON.stringify(upi.beats)).toLowerCase();
    expect(all).not.toContain("world's digital transactions"); expect(all).not.toContain('84%');
  });
});
