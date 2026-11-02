import { describe, it, expect } from 'vitest';
import { runCandidate, expandQuote, valueInQuote, qualifierDropped, attributed, similar, verdict, quoteInSource, type Runners } from '../src/gen/pipeline';
import { classifyClaims } from '../src/gen/ledger';
import { pickBeats, questionOk } from '../src/worker/genrun';
// FIXTURE responses again: these prove that each hole found in the source is now closed. They say nothing about what a real model will write.
const S = (id: string, g: string, text: string, publisher = g, url = `https://${g}.test`) => ({ id, url, publisher, license: 'unknown' as const, groupId: g, text });
const run = (ext: Record<string, string>, writes: string[], over: Partial<Runners> = {}, notes: string[] = []): Runners => {
  let w = 0;
  return { extract: async (_t, text) => ext[text], outline: async () => [1, 2, 3, 4, 5].map((n) => `paragraph ${n}: p${n} | c1 c2`).join('\n'), write: async () => writes[w++] ?? '', judge: async () => 'SUPPORTED', review: async () => 'none', reserve: () => true, note: (m) => notes.push(m), ...over };
};

describe('evidence is the whole source sentence, so a trimmed quote cannot hide a qualifier', () => {
  it('expands a fragment to its sentence', () => expect(expandQuote('20,000 emus arrived', 'Farmers complained. About 20,000 emus arrived in the district, by one count. The army came.')).toBe('About 20,000 emus arrived in the district, by one count.'));
  it('does not cut at abbreviations or decimals', () => {
    expect(expandQuote('20,000 coins in 1890', 'It cost approx. 20,000 coins in 1890. Next.')).toBe('It cost approx. 20,000 coins in 1890.');
    expect(expandQuote('Louis was founded in 1764', 'The city of St. Louis was founded in 1764. Next.')).toBe('The city of St. Louis was founded in 1764.');
  });
  it('a quote that spans a sentence boundary still resolves (up to three sentences)', () => expect(expandQuote('began in 1890. It grew', 'It began in 1890. It grew fast. Done.')).toBe('It began in 1890. It grew fast.'));
  it('quotes match whole words only', () => { expect(quoteInSource('war began', 'The warrant began')).toBe(false); expect(quoteInSource('war began', 'The war began.')).toBe(true); });
  it('the judge is given the whole sentence, not the model\'s fragment', async () => {
    const A = S('a', 'a', 'About 20,000 emus arrived in the district. The army came later.'), B = S('b', 'b', 'Roughly 20,000 emus arrived in the district. Farmers asked for help.'); const seen: string[] = [];
    await runCandidate('Emus', [A, B], run({ [A.text]: 'emus | 20,000 | 20,000 emus arrived in the district', [B.text]: 'emus | 20,000 | 20,000 emus arrived in the district' }, ['About 20,000 emus arrived in the district. || c1'], { judge: async (p) => (seen.push(p), 'SUPPORTED') }));
    expect(seen[0]).toContain('About 20,000 emus arrived in the district.');
  });
  it('a hedged number stated without its hedge is refused before any judge call', async () => {
    const A = S('a', 'a', 'About 20,000 emus arrived in the district. The army came later.'), B = S('b', 'b', 'Roughly 20,000 emus arrived in the district. Farmers asked for help.'); let judged = 0;
    const r = await runCandidate('Emus', [A, B], run({ [A.text]: 'emus | 20,000 | 20,000 emus arrived in the district', [B.text]: 'emus | 20,000 | 20,000 emus arrived in the district' }, ['The district saw 20,000 emus arrive. || c1'], { judge: async () => (judged++, 'SUPPORTED') }));
    expect(r.outcome).toEqual({ ok: false, reason: 'qualifier_dropped' }); expect(judged).toBe(0);
  });
  it('qualifier rules', () => {
    expect(qualifierDropped('About 20,000 emus came.', 'About 20,000 emus arrived.')).toBeNull();
    expect(qualifierDropped('20,000 emus came.', 'About 20,000 emus arrived.')).toBe('approx:20000');
    expect(qualifierDropped('Over 5 people came.', 'More than 5 people came.')).toBeNull(); expect(qualifierDropped('5 people came.', 'More than 5 people came.')).toBe('lower:5'); expect(qualifierDropped('5 people came.', 'Up to 5 people came.')).toBe('upper:5');
    expect(qualifierDropped('The line opened in 1853.', 'The line may have opened in 1853.')).toBe('modal'); expect(qualifierDropped('The line probably opened in 1853.', 'The line may have opened in 1853.')).toBeNull();
    expect(qualifierDropped('The line opened in 1853.', 'The line opened in 1853.')).toBeNull();
  });
});

describe('the value that drives agreement is stated in the quote', () => {
  it('numbers and long words must appear', () => { expect(valueInQuote('1890', 'The system began in 1890.')).toBe(true); expect(valueInQuote('1932', 'The system began in 1890.')).toBe(false); expect(valueInQuote('175000-200000', 'between 175,000 and 200,000')).toBe(true); expect(valueInQuote('bicycles', 'Collectors use a bicycle.')).toBe(true); expect(valueInQuote('trains', 'Collectors use bicycles.')).toBe(false); });
  it('a claim whose value is not in its own quote never enters the ledger, so it cannot corroborate', async () => {
    const A = S('a', 'a', 'The system began in 1890. Boxes move daily.'), B = S('b', 'b', 'Trains ran in 1873. Nothing else is said here.');
    const r = await runCandidate('T', [A, B], run({ [A.text]: 'start_year | 1890 | The system began in 1890', [B.text]: 'start_year | 1890 | Trains ran in 1873' }, []));
    expect(r.outcome).toEqual({ ok: false, reason: 'too_few_sources' });
  });
  it('a quote that is only a word or two is refused', async () => {
    const A = S('a', 'a', 'The system began in 1890.'), B = S('b', 'b', 'It was 1890 when it began.');
    expect((await runCandidate('T', [A, B], run({ [A.text]: 'start_year | 1890 | 1890', [B.text]: 'start_year | 1890 | 1890' }, []))).outcome).toEqual({ ok: false, reason: 'too_few_sources' });
  });
});

describe('Wikipedia is never an independent voice', () => {
  const W = S('wp', 'wikipedia', 'The tram line opened in 1873 and is run by WBTC.', 'Wikipedia', 'https://en.wikipedia.org/wiki/Tram');
  const B = S('b', 'b', 'Trams began in 1873. WBTC runs them.'), C = S('c', 'c', 'The first trams ran in 1873 on this line.');
  const ext: Record<string, string> = { [W.text]: 'opened | 1873 | opened in 1873', [B.text]: 'opened | 1873 | began in 1873', [C.text]: 'opened | 1873 | trams ran in 1873' };
  it('Wikipedia plus one outside source that agree is still single', () => {
    const g = classifyClaims([W, B], [{ id: 'c1', sourceId: 'wp', key: 'opened', value: '1873', quote: 'opened in 1873' }, { id: 'c2', sourceId: 'b', key: 'opened', value: '1873', quote: 'began in 1873' }]);
    expect(g[0].status).toBe('single');
  });
  it('two outside sources that agree are central', () => expect(classifyClaims([B, C], [{ id: 'c1', sourceId: 'b', key: 'opened', value: '1873', quote: 'began in 1873' }, { id: 'c2', sourceId: 'c', key: 'opened', value: '1873', quote: 'trams ran in 1873' }])[0].status).toBe('central'));
  it('Wikipedia disagreeing with an outside source is still a dispute', () => expect(classifyClaims([W, B], [{ id: 'c1', sourceId: 'wp', key: 'opened', value: '1873', quote: 'x' }, { id: 'c2', sourceId: 'b', key: 'opened', value: '1874', quote: 'y' }])[0].status).toBe('disputed'));
  it('a run with Wikipedia and ONE outside source is refused', async () => expect((await runCandidate('T', [W, B], run(ext, []))).outcome).toEqual({ ok: false, reason: 'too_few_sources' }));
  it('with a second outside source it proceeds past the source gate', async () => expect((await runCandidate('T', [W, B, C], run(ext, []))).outcome).not.toEqual({ ok: false, reason: 'too_few_sources' }));
});

describe('disagreements under different keys are not missed', () => {
  const A = S('a', 'a', 'x'), B = S('b', 'b', 'y');
  it('similar statements with disjoint numbers under different keys become disputed', () => {
    const g = classifyClaims([A, B], [{ id: 'c1', sourceId: 'a', key: 'start_year', value: '1873', quote: 'The tram line opened in 1873 in Calcutta' }, { id: 'c2', sourceId: 'b', key: 'first_run_year', value: '1876', quote: 'The first tram line opened in 1876 in Calcutta' }]);
    expect(g.map((x) => x.status)).toEqual(['disputed', 'disputed']);
  });
  it('unrelated claims, or claims that share a number, are left alone', () => {
    expect(classifyClaims([A, B], [{ id: 'c1', sourceId: 'a', key: 'k1', value: '1873', quote: 'The tram line opened in 1873 in Calcutta' }, { id: 'c2', sourceId: 'b', key: 'k2', value: '40', quote: 'Fares were set at 40 paise for tourists' }]).map((x) => x.status)).toEqual(['single', 'single']);
    expect(classifyClaims([A, B], [{ id: 'c1', sourceId: 'a', key: 'k1', value: '1873', quote: 'The tram line opened in 1873 in Calcutta' }, { id: 'c2', sourceId: 'b', key: 'k2', value: '1873', quote: 'The first tram line opened in 1873 in Calcutta' }]).map((x) => x.status)).toEqual(['single', 'single']);
  });
});

describe('attribution names the source', () => {
  it('rules', () => { expect(attributed('According to Wikipedia, it opened.', 'Wikipedia')).toBe(true); expect(attributed('According to legend, it opened.', 'Wikipedia')).toBe(false); expect(attributed('bbc.co.uk says it opened.', 'bbc.co.uk')).toBe(true); expect(attributed('According to the BBC, it opened.', 'bbc.co.uk')).toBe(true); expect(attributed('It opened, he says.', 'Wikipedia')).toBe(false); });
});

describe('repetition', () => {
  it('near-identical sentences are the same sentence', () => { expect(similar('Collectors carry the lunch boxes on bicycles through the city.', 'Through the city, collectors carry lunch boxes on bicycles.')).toBe(true); expect(similar('The system began in 1890 with a few men.', 'Collectors carry lunch boxes on bicycles through the city.')).toBe(false); });
});

describe('the judge word is read one way everywhere', () => {
  it('verdict', () => { for (const ok of ['SUPPORTED', 'Supported.', ' supported\n', '"Supported"']) expect(verdict(ok), ok).toBe('supported'); for (const no of ['Supported, but the year is not stated', 'NOT', 'Not supported', '']) expect(verdict(no), no).toBe('other'); expect(verdict('PARTLY.')).toBe('partly'); });
});

describe('hook, answers and questions', () => {
  it('whole sentences come from the pipeline, not from re-splitting on full stops', () => {
    const cand = { paragraphs: ['It cost approx. 20 coins in 1890. Next.', 'The city of St. Louis grew. More.', 'B. Done.', 'C. Done.'], sentences: [['It cost approx. 20 coins in 1890.', 'Next.'], ['The city of St. Louis grew.', 'More.'], ['B one.'], ['C one.']] };
    const b = pickBeats(cand); expect(b.hook).toBe('It cost approx. 20 coins in 1890.'); expect(b.ans).toEqual(['The city of St. Louis grew.', 'B one.', 'C one.']);
  });
  it('without a sentence list it still works, with the old splitting', () => expect(pickBeats({ paragraphs: ['One. Two.', 'Three.', 'Four.', 'Five.'] }).ans).toEqual(['Three.', 'Four.', 'Five.']));
  it('a question may not add names or digits', () => {
    expect(questionOk('Why did the emus win?', 'The emus won because they split into small groups.')).toBe(true);
    expect(questionOk('Why did Major Meredith lose?', 'The emus won because they split into small groups.')).toBe(false);
    expect(questionOk('What happened in 1932?', 'It began in 1932.')).toBe(false); expect(questionOk('What happened?', 'It began.')).toBe(true); expect(questionOk('Not a question.', 'x')).toBe(false);
  });
});

describe('a story is accepted only on explicit terms', () => {
  const A = S('a', 'a', 'The system began in 1890. Boxes move between 175,000 and 200,000 a day. Delivery crews use bicycles. Lunch is carried in tin boxes. Crews wear white caps.'), B = S('b', 'b', 'It was 1890 when the system started.');
  const ext = { [A.text]: 'start_year | 1890 | The system began in 1890\nboxes | 175000-200000 | Boxes move between 175,000 and 200,000 a day\nbikes | bicycles | Delivery crews use bicycles\nlunch | tin boxes | Lunch is carried in tin boxes\ncaps | white | Crews wear white caps', [B.text]: 'start_year | 1890 | It was 1890 when the system started' };
  const GOOD = ['Most accounts say it began in 1890. || c1', 'According to a, boxes move between 175,000 and 200,000 a day. || c2', 'According to a, delivery crews use bicycles. || c3', 'According to a, lunch is carried in tin boxes. || c4', 'According to a, crews wear white caps. || c5'];
  const go = (writes: string[], over: Partial<Runners> = {}) => runCandidate('T', [A, B], run(ext, writes, over));
  it('baseline: the fixture story passes', async () => expect((await go(GOOD)).outcome).toEqual({ ok: true }));
  it('an empty review is not "none"', async () => { expect((await go(GOOD, { review: async () => '' })).outcome).toEqual({ ok: false, reason: 'rubric_failed' }); expect((await go(GOOD, { review: async () => '  ' })).outcome).toEqual({ ok: false, reason: 'rubric_failed' }); });
  it('"according to legend" is not attribution to the source', async () => expect((await go([GOOD[0], GOOD[1], 'According to legend, delivery crews use bicycles. || c3'])).outcome).toEqual({ ok: false, reason: 'unsupported_sentence' }));
  it('the same fact told again from the other source is a repeat', async () => expect((await go([GOOD[0], 'Another source also says it started in 1890. || c6'])).outcome).toEqual({ ok: false, reason: 'repeated_fact' }));
  it('the same fact twice in one paragraph is a repeat', async () => expect((await go(['Most accounts say it began in 1890. || c1\nIt was 1890 when it all began. || c1'])).outcome).toEqual({ ok: false, reason: 'repeated_fact' }));
  it('the writer is told what has already been written', async () => { const prompts: string[] = []; await go(GOOD, { write: async (p) => (prompts.push(p), GOOD[prompts.length - 1]) }); expect(prompts[0]).not.toContain('Already written'); expect(prompts[1]).toContain('Already written'); expect(prompts[1]).toContain('Most accounts say it began in 1890.'); });
  it('only seven planned paragraphs are ever written', async () => { let n = 0; await go(GOOD, { outline: async () => Array.from({ length: 20 }, (_, i) => `paragraph ${i + 1}: p | c1`).join('\n'), write: async () => (n++, '') }); expect(n).toBe(7); });
});
