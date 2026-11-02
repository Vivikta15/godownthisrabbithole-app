import { describe, it, expect } from 'vitest';
import { htmlToText, bodyText } from '../src/gen/source';
import { runCandidate, type Runners } from '../src/gen/pipeline';
import { stopReason } from '../src/worker/genrun';
// Defects found when reviewing the 12-file patch on fix-1102. The svg, nested-article and one-sided-dispute cases were reproduced on that patch before the fix; stopReason is new.
const body = 'The measure was introduced in the early years and continues today in many places around the country. '.repeat(30);

describe('source cleaning keeps the story', () => {
  it('a self-closing <svg/> icon does not delete everything after it', () => { const t = htmlToText(`<p>Intro paragraph one.</p><svg class="i"/><p>Body after the icon. ${body}</p>`); expect(t).toContain('Body after the icon.'); expect(t.length).toBeGreaterThan(1000); });
  it('an unterminated <style> still drops the rest of the page, as the patch intends', () => expect(htmlToText('<p>Keep this.</p><style>.a{color:red} <p>junk that is css</p>')).toBe('Keep this.'));
  it('a properly closed <svg> block is removed and the text after it stays', () => { const t = htmlToText('<p>One.</p><svg viewBox="0 0 1 1"><path d="M0"/></svg><p>Two.</p>'); expect(t).toContain('One.'); expect(t).toContain('Two.'); expect(t).not.toContain('path'); });
  it('an <article> that holds a related-story <article> is not cut at the first </article>', () => {
    const t = bodyText(`<html><body><article><p>${body}FIRST HALF.</p><article><p>Related teaser text.</p></article><p>${body}SECOND HALF.</p></article></body></html>`);
    expect(t).toContain('FIRST HALF'); expect(t).toContain('SECOND HALF');
  });
  it('the longest of several separate articles is still chosen', () => expect(bodyText(`<article><p>short teaser</p></article><article><p>${body}THE REAL ONE.</p></article>`)).toContain('THE REAL ONE'));
});

describe('a disagreement told from one side only is the dispute stated as fact', () => {
  const S = (id: string, g: string, text: string) => ({ id, url: `https://${g}.test`, publisher: g, license: 'unknown' as const, groupId: g, text });
  const A = S('a', 'a', 'The line opened in 1873. Trams carry riders daily. Fares are low. Depots are old. Cars are green.'), B = S('b', 'b', 'The line opened in 1876. Other note here.'), C = S('c', 'c', 'Fares are low on this line.');
  const ext: Record<string, string> = { [A.text]: 'opened | 1873 | The line opened in 1873\nride | riders | Trams carry riders daily\nfare | low | Fares are low\ndepot | old | Depots are old\ncars | green | Cars are green', [B.text]: 'opened | 1876 | The line opened in 1876', [C.text]: 'fare | low | Fares are low on this line' };
  // claims: a: c1 opened(1873) c2 ride c3 fare c4 depot c5 cars; b: c6 opened(1876); c: c7 fare(low). opened is disputed (c1 vs c6); fare is central (a, c).
  const go = async (writes: string[], prompts: string[] = []) => { let w = 0; const r: Runners = { extract: async (_t, x) => ext[x], outline: async () => 'paragraph 1: open | c1', write: async (p) => (prompts.push(p), writes[w++] ?? ''), judge: async () => 'SUPPORTED', review: async () => 'none', reserve: () => true }; return (await runCandidate('Trams', [A, B, C], r)).outcome; };
  it('"accounts differ, but it most likely opened in 1873" citing only one side is refused', async () => expect(await go(['Accounts differ, but the line most likely opened in 1873. || c1'])).toEqual({ ok: false, reason: 'disputed_stated_as_fact' }));
  it('the writer is handed every side of a disputed fact, even when the plan named one', async () => { const p: string[] = []; await go(['Accounts differ: A says 1873 and B says 1876. || c1 c6'], p); expect(p[0]).toContain('[c1]'); expect(p[0]).toContain('[c6]'); });
});

describe('why a model call stopped', () => {
  it('only a real provider failure counts toward the provider-failing breaker', () => { expect(stopReason('over_cap')).toBe('cap_reached'); expect(stopReason('prompt_too_long')).toBe('rubric_failed'); expect(stopReason('bad_model')).toBe('provider_error'); expect(stopReason('provider_error')).toBe('provider_error'); });
});
