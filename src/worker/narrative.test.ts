import { describe, it, expect } from 'vitest';
import { qualifiersOk, mechanicalOk, parseGen, cacheKey, generateStory } from './narrative';
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
import { it as it2, expect as expect2 } from 'vitest';
it2('qualifier guard', () => { expect2(qualifiersOk('Honey does not spoil.', ['When properly stored, honey does not spoil.'])).toBe(false); expect2(qualifiersOk('Honey does not spoil when properly stored.', ['When properly stored, honey does not spoil.'])).toBe(true); expect2(qualifiersOk('Venus is hot.', ['Venus is hot.'])).toBe(true); });
it2('qualifier guard adversarial: known limits', () => {
  // caught: hedge dropped entirely
  expect2(qualifiersOk('Octopuses live in every ocean.', ['Octopuses may live in most oceans.'])).toBe(false);
  // NOT caught by token presence (documented limit): hedge present but a different one, or moved to the wrong clause
  expect2(qualifiersOk('Some octopuses live in every ocean.', ['Octopuses may live in most oceans.'])).toBe(true);
});
