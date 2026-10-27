import { describe, it, expect } from 'vitest';
import { candidates, type Page } from './bridge';
const P = (title: string, text: string, links: string[]): Page => ({ title, url: 'u', text, links: new Set(links) });
describe('bridge candidates', () => {
  const a = P('Honey', 'Bees make honey from nectar. Honey has been used in Mead across many cultures and is very old indeed.', ['Mead', 'Earth', 'Bee']);
  const b = P('Viking', 'The Vikings drank Mead at their feasts and celebrated with long toasts in great halls. They sailed far.', ['Mead', 'Earth']);
  it('needs a shared link AND a copied sentence mentioning it in both pages; drops hubs', () => {
    const c = candidates(a, b); expect(c.map((x) => x.via)).toEqual(['Mead']); expect(a.text.includes(c[0].sentA)).toBe(true); expect(b.text.includes(c[0].sentB)).toBe(true);
  });
  it('rejects when a page links the topic but never says it in a sentence', () => {
    expect(candidates(P('X', 'Short text without the topic at all, just filler words to pass length limits ok.', ['Mead']), b)).toEqual([]);
  });
});
