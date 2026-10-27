import { describe, it, expect } from 'vitest';
import { mechanicalOk, parseGen, cacheKey, generateStory } from './narrative';
const page = { title: 'Venus', url: 'u', links: new Set<string>(), text: Array.from({ length: 10 }, (_, i) => `Source sentence number ${i + 1} says Venus takes 243 Earth days to turn once in space.`).join(' ') };
describe('narrative', () => {
  it('mechanical check', () => { expect(mechanicalOk('Venus takes 243 days.', ['It takes 243 Earth days.'])).toBe(true); expect(mechanicalOk('Venus takes 244 days.', ['It takes 243 Earth days.'])).toBe(false); expect(mechanicalOk('Then Pearce left.', ['Minister Smith left.'])).toBe(false); });
  it('parses and keys', () => { expect(parseGen('{"paragraphs":[[{"t":"A","c":[1]}]]}')?.[0][0].c).toEqual([1]); expect(parseGen('nope')).toBeNull(); expect(cacheKey('Venus', '123', 'qa', 'long')).toBe('n1:venus:123:qa:long'); });
  it('drops whole paragraph when the judge says no, falls back when too few remain', async () => {
    const db = { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) }) };
    let n = 0; const AI = { run: async () => (n++ === 0 ? { response: { paragraphs: [[{ t: 'Venus takes 243 Earth days to turn.', c: [1] }], [{ t: 'Venus takes 243 Earth days to turn.', c: [2] }]] } } : { response: 'NOT' }) };
    const r = await generateStory({ DB: db as any, AI, AI_ENABLED: 'true', AI_PLAN_CONFIRMED: 'free' } as any, page as any, 'narrative', 'short'); expect(r.ok).toBe(false);
  });
});
