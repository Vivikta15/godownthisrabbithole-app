import { describe, it, expect } from 'vitest';
import { runCandidate, parseExtract, parseWrite, quoteInSource, type Runners } from '../src/gen/pipeline';
// FIXTURE responses. These tests prove the refusal rules and orchestration only. They say nothing about model quality or truth.
const S = [
  { id: 'a', url: 'https://example.test/a', publisher: 'A', license: 'cc-by-sa' as const, groupId: 'a', text: 'The system began in 1890. Boxes per day: between 175,000 and 200,000.' },
  { id: 'b', url: 'https://example.test/b', publisher: 'B', license: 'unknown' as const, groupId: 'b', text: 'It was 1890 when the system started. A crew of 50 started it. Collectors use bicycles.' },
  { id: 'c', url: 'https://example.test/c', publisher: 'C', license: 'unknown' as const, groupId: 'c', text: 'The founder began with about 100 men.' },
];
const ext: Record<string, string> = {
  a: 'start_year | 1890 | The system began in 1890\nboxes | 175000-200000 | between 175,000 and 200,000\nfake | 1 | this quote is not in the text',
  b: 'start_year | 1890 | It was 1890 when the system started\ncrew | 50 | A crew of 50 started it\nbikes | bicycles | Collectors use bicycles',
  c: 'crew | 100 | The founder began with about 100 men',
};
const plan = [1, 2, 3, 4, 5].map((n) => `paragraph ${n}: purpose ${n} | c1 c2`).join('\n');
function runners(over: Partial<Runners> = {}, writes: string[] = []): Runners {
  let w = 0; const calls: string[] = [];
  return { extract: async (_t, text) => ext[S.find((s) => s.text === text)!.id], outline: async () => plan, write: async () => writes[w++] ?? 'Most accounts say it began in 1890. || c1', judge: async () => 'supported', review: async () => 'none', reserve: (st) => (calls.push(st), true), ...over };
}
describe('parsers', () => {
  it('extract lines parse, bad lines drop', () => expect(parseExtract('key | v | q\nstart | 1890 | began in 1890\nnone\njunk')).toEqual([{ key: 'start', value: '1890', quote: 'began in 1890' }]));
  it('write lines need a citation separator', () => expect(parseWrite('A sentence. || c1, c2\nno cite here')).toEqual([{ t: 'A sentence.', ids: ['c1', 'c2'] }]));
  it('quote must exist in source, ignoring case and punctuation', () => { expect(quoteInSource('began in 1890!', 'It began in 1890.')).toBe(true); expect(quoteInSource('began in 1891', 'It began in 1890.')).toBe(false); });
});
const GOOD = ['Most accounts say it began in 1890. || c1', 'According to A, between 175,000 and 200,000 boxes move a day. || c2', 'Another source also says it started in 1890. || c3', 'According to B, collectors use bicycles. || c5', 'Accounts differ on the first crew: 50 in one source, about 100 in another. || c4 c6'];
describe('orchestration refusals', () => {
  it('needs two independent sources', async () => { expect((await runCandidate('T', [S[0]], runners())).outcome).toEqual({ ok: false, reason: 'too_few_sources' }); });
  it('fabricated quotes never enter the ledger', async () => { expect((await runCandidate('T', S, runners({}, ['Fake fact. || c99']))).outcome.ok).toBe(false); });
  it('a disputed claim stated plainly is refused', async () => { expect((await runCandidate('T', S, runners({}, ['It began with about 100 men. || c6']))).outcome).toEqual({ ok: false, reason: 'disputed_stated_as_fact' }); });
  it('a single-source claim without attribution is refused', async () => { expect((await runCandidate('T', S, runners({}, ['Collectors use bicycles. || c5']))).outcome).toEqual({ ok: false, reason: 'unsupported_sentence' }); });
  it('a number not in the cited quote is refused', async () => { expect((await runCandidate('T', S, runners({}, ['It began in 1891. || c1']))).outcome).toEqual({ ok: false, reason: 'unsupported_sentence' }); });
  it('a repeated fact is refused', async () => { expect((await runCandidate('T', S, runners())).outcome).toEqual({ ok: false, reason: 'repeated_fact' }); });
  it('judge partly supported is a refusal', async () => { expect((await runCandidate('T', S, runners({ judge: async () => 'partly' }, GOOD))).outcome).toEqual({ ok: false, reason: 'qualifier_dropped' }); });
  it('reviewer defects refuse', async () => { expect((await runCandidate('T', S, runners({ review: async () => 'dropped qualifier in paragraph 2' }, GOOD))).outcome).toEqual({ ok: false, reason: 'rubric_failed' }); });
  it('provider errors refuse, not publish', async () => { expect((await runCandidate('T', S, runners({ judge: async () => { throw new Error('x'); } }, GOOD))).outcome).toEqual({ ok: false, reason: 'provider_error' }); });
  it('a refused reservation stops the run', async () => { let n = 0; expect((await runCandidate('T', S, runners({ reserve: () => ++n < 5 }, GOOD))).outcome).toEqual({ ok: false, reason: 'cap_reached' }); });
});
describe('a candidate that passes every fixture check', () => {
  it('is only a candidate, labelled, with licence flags, and claims no verification', async () => {
    const r = await runCandidate('T', S, runners({}, GOOD)); expect(r.outcome).toEqual({ ok: true });
    expect(r.candidate!.status).toBe('candidate'); expect(r.candidate!.paragraphs.length).toBe(5); expect(r.candidate!.label).toMatch(/Not verified by a person/); expect(r.candidate!.label).not.toMatch(/^Verified/);
    expect(r.candidate!.licenceFlags.join()).toMatch(/share-alike/); expect(r.candidate!.sourceUrls.length).toBe(3);
  });
});
