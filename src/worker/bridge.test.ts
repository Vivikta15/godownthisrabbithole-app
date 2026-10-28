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
import { directMention, boring } from './bridge';
describe('direct mentions and boring topics', () => {
  const wombat = P('Wombat', 'Wombats are marsupials from Australia. Wombats leave distinctive cube-shaped faeces, which they stack to mark territory.', []);
  const cube = P('Cube', 'A cube is a three-dimensional solid object bounded by six square faces, facets or sides, with three meeting at each vertex.', []);
  it('copies the exact sentence where one page names the other page subject', () => {
    const s = directMention(wombat, cube); expect(s).toContain('cube-shaped'); expect(wombat.text.includes(s!)).toBe(true);
    expect(directMention(cube, wombat)).toBeNull();
  });
  it('does not match inside longer words', () => {
    expect(directMention(P('X', 'The discube and other cubicles are not the same thing as the shape in question here at all.', []), cube)).toBeNull();
  });
  it('flags language roots and generic science words but keeps specific topics', () => {
    for (const t of ['Proto-Indo-European', 'Old English', 'Density', 'Hellenistic period']) expect(boring(t)).toBe(true);
    for (const t of ['Pigment', 'Intertropical Convergence Zone', 'Haitian Revolution']) expect(boring(t)).toBe(false);
  });
});
