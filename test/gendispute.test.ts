import { describe, it, expect } from 'vitest';
import { runCandidate, type Runners } from '../src/gen/pipeline';
// FIXTURE responses (scripted writer). They prove the repeat rule only; they say nothing about what a real model writes.
// Claim ids: a: c1 start_year(1890), c2 boxes. b: c3 start_year(1890), c4 crew(50), c5 bikes. c: c6 crew(100), c7 lunch. crew is disputed (c4 vs c6); start_year is central.
const S = [
  { id: 'a', url: 'https://example.test/a', publisher: 'A', license: 'cc-by-sa' as const, groupId: 'a', text: 'The system began in 1890. Boxes per day: between 175,000 and 200,000.' },
  { id: 'b', url: 'https://example.test/b', publisher: 'B', license: 'unknown' as const, groupId: 'b', text: 'It was 1890 when the system started. A crew of 50 started it. Collectors use bicycles.' },
  { id: 'c', url: 'https://example.test/c', publisher: 'C', license: 'unknown' as const, groupId: 'c', text: 'The founder began with about 100 men. Lunch is carried in tin boxes.' },
];
const ext: Record<string, string> = {
  a: 'start_year | 1890 | The system began in 1890\nboxes | 175000-200000 | between 175,000 and 200,000',
  b: 'start_year | 1890 | It was 1890 when the system started\ncrew | 50 | A crew of 50 started it\nbikes | bicycles | Collectors use bicycles',
  c: 'crew | 100 | The founder began with about 100 men\nlunch | tin boxes | Lunch is carried in tin boxes',
};
const plan = [1, 2, 3, 4, 5].map((n) => `paragraph ${n}: purpose ${n} | c1 c2`).join('\n');
const SIDE_B = 'Accounts differ: B says a crew of 50 started it. || c4', SIDE_C = 'Accounts differ: C says the founder began with about 100 men. || c6';
const P = { year: 'Most accounts say it began in 1890. || c1', boxes: 'According to A, between 175,000 and 200,000 boxes move a day. || c2', lunch: 'According to C, lunch is carried in tin boxes. || c7', bikes: 'According to B, collectors use bicycles. || c5' };
const go = async (writes: string[]) => { let w = 0; const r: Runners = { extract: async (_t: string, text: string) => ext[S.find((s) => s.text === text)!.id], outline: async () => plan, write: async () => writes[w++], judge: async () => 'supported', review: async () => 'none', reserve: () => true } as any; return (await runCandidate('T', S, r)).outcome; };
describe('a disputed key may be told side by side in one paragraph, and nowhere else', () => {
  it('two sentences, one per side, in one paragraph are accepted', async () => { expect(await go([P.year, P.boxes, P.lunch, P.bikes, `${SIDE_B}\n${SIDE_C}`])).toEqual({ ok: true }); });
  it('one sentence citing both sides is still accepted', async () => { expect(await go([P.year, P.boxes, P.lunch, P.bikes, 'Accounts differ on the crew: B says 50 men, C says about 100. || c4, c6'])).toEqual({ ok: true }); });
  it('the same side told twice in one paragraph is refused', async () => { expect(await go([P.year, P.boxes, P.lunch, P.bikes, `${SIDE_B}\nAccounts differ: B also says that fifty people formed the first crew. || c4`])).toEqual({ ok: false, reason: 'repeated_fact' }); });
  it('the disputed key told again in a later paragraph is refused', async () => { expect(await go([P.year, SIDE_B, P.lunch, P.bikes, SIDE_C])).toEqual({ ok: false, reason: 'disputed_stated_as_fact' }); }); // refused as soon as the first paragraph tells only one side; before the paragraph-end rule this was caught later as repeated_fact
  it('a side told in a later paragraph after the other side is refused', async () => { expect(await go([P.year, P.boxes, P.lunch, SIDE_B, SIDE_C])).toEqual({ ok: false, reason: 'disputed_stated_as_fact' }); });
  it('a central key told again in the same paragraph through the other source is still refused', async () => { expect(await go([`${P.year}\nThe 1890 start is confirmed by a second page. || c3`, P.boxes, P.lunch, P.bikes, `${SIDE_B}\n${SIDE_C}`])).toEqual({ ok: false, reason: 'repeated_fact' }); });
  it('each side must still say that accounts differ', async () => { expect(await go([P.year, P.boxes, P.lunch, P.bikes, `${SIDE_B}\nC says the founder began with about 100 men. || c6`])).toEqual({ ok: false, reason: 'disputed_stated_as_fact' }); });
});
