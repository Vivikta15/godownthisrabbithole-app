// Candidate-story pipeline with injected runners. Preparation: the runners here are fixtures; no model is called and nothing is wired.
// Fixture tests show the orchestration and the refusal rules work. They do NOT show that a model writes good or true stories.
import { classifyClaims, allowedPhrasing, licenceFlags, squash, nums, contentWords, type Source, type Claim, type Outcome, type Rejection } from './ledger';

export const PROMPTS = {
  // Output format: one claim per line "key | value | exact quote". The quote must be copied from the source text.
  extract: (title: string, text: string, known = '') => `You are extracting facts from one source about "${title}". Output one line per fact: key | value | exact quote copied from the text. Use short snake_case keys such as start_year or boxes_per_day. Use the same key for the same question across sources. Only facts stated in the text. No placeholders, no commentary.${known ? `\n\nFacts already found in OTHER sources (key | value). Where this text answers the same question, reuse that exact key and give the value in the same form (same units, same date format), as long as this text really says so. Never copy a value this text does not state. Quote only from this text.\n${known}` : ''}\n\nSOURCE TEXT:\n${text}`,
  outline: (title: string, ledger: string, country: string) => `Plan a 7 paragraph story about "${title}" for a curious reader in ${country}. Start from something the reader already knows. Use only these facts (id: key = value, status):\n${ledger}\nOutput 7 lines "paragraph N: purpose | fact ids". Where a fact is marked disputed, give it its own paragraph that says accounts differ. Do not plan trivia.`,
  write: (purpose: string, facts: string, told = '') => `Write one paragraph (3 to 5 sentences) for this purpose: ${purpose}. Use only these facts and cite each sentence. Output lines "sentence || fact ids". Facts marked "single" must say "according to <publisher>". Facts marked "disputed" may only appear as "accounts differ". Keep every qualifier in the source (such as "about", "usually", "may"). Never invent. Never repeat a fact used in an earlier paragraph.${told ? `\nAlready written (do not restate any of it, in any wording):\n${told}` : ''}\n${facts}`,
  // Same shape as the benchmarked judge (scripts/judge-bench-paid.mjs) and the canary. The system prompt is JUDGE_SYSTEM in src/worker/judge.ts. Answers SUPPORTED, PARTLY or NOT.
  judge: (claim: string, quotes: string) => `SOURCE:\n"""${quotes}"""\n\nCLAIM: ${claim}\n\nOne word:`,
  review: (story: string, quotes: string) => `Find defects in this story against the quotes: dropped qualifiers, overclaims, a disputed fact stated plainly, repeated facts across paragraphs, trivia, abrupt jumps. Output "none" or one defect per line.\nQUOTES:\n${quotes}\nSTORY:\n${story}`,
};

export const DISAGREE = /\b(accounts differ|sources differ|disagree|disputed|not agreed)\b/i;

export function parseExtract(raw: string): { key: string; value: string; quote: string }[] {
  return raw.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 3 && p[0] && p[1] && p[2] && !/^(key|fact|none)$/i.test(p[0])).map((p) => ({ key: p[0], value: p[1], quote: p.slice(2).join('|').trim() }));
}
// A claim is kept only if its quote really occurs, as whole words, in the source text it came from. That proves the words exist, not that they support the claim:
// see expandQuote and valueInQuote below.
export const quoteInSource = (quote: string, text: string) => { const q = squash(quote); return q.length > 0 && ` ${squash(text)} `.includes(` ${q} `); };
export const MIN_QUOTE_WORDS = 3;
// A model may quote only a fragment ("20,000 emus") of a sentence that carries the qualifier ("about 20,000 emus, by one account"). Evidence is therefore widened to the whole
// source sentence (up to three sentences if the quote spans a boundary), so the judge and every later check see the qualifiers and scope the source actually gave.
const SPLIT = /(?<=[.!?]['")\]]*)(?<!\b(?:St|Mr|Mrs|Ms|Dr|Prof|No|vs|ca?|approx|e\.g|i\.e|U\.S|Jr|Sr)\.)\s+(?=["'(\[]?[A-Z])|\n+/;
export function expandQuote(quote: string, text: string): string | null {
  const sents = text.split(SPLIT).map((x) => x.trim()).filter(Boolean);
  for (let w = 1; w <= 3; w++) for (let i = 0; i + w <= sents.length; i++) { const win = sents.slice(i, i + w).join(' '); if (quoteInSource(quote, win)) return win.length <= 900 ? win : null; }
  return null;
}
// The value that drives agreement and disagreement must itself be stated in the quote: every number, and every word of four letters or more (plural-tolerant).
export function valueInQuote(value: string, quote: string): boolean {
  const qn = nums(quote); if (!nums(value).every((n) => qn.includes(n))) return false;
  const q = ` ${squash(quote)} `; return squash(value).split(' ').filter((w) => w.length >= 4 && !/^\d+$/.test(w)).every((w) => q.includes(` ${w} `) || q.includes(` ${w.replace(/(es|s)$/, '')}`));
}
// Same word rule as the production judge, exported so the canary cannot count an answer differently from the pipeline (the canary used to demand the bare word).
export const verdict = (raw: string): 'supported' | 'partly' | 'other' => (/^[\s"'`*]*supported[\s.!"'`*]*$/i.test(raw) ? 'supported' : /^[\s"'`*]*partly[\s.!"'`*]*$/i.test(raw) ? 'partly' : 'other');
// "according to <publisher>" or "<publisher> says" must actually name the source the claim came from, not just contain the words.
export function attributed(sentence: string, publisher: string): boolean {
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const alts = [...new Set([publisher, publisher.split('.')[0]].filter((x) => x.length > 0))].map(esc).join('|');
  return new RegExp(`according to (?:the )?(?:${alts})\\b|\\b(?:${alts})\\s+(?:says|reports|writes|notes|states|explains)\\b`, 'i').test(sentence);
}
// Qualifiers. A number the source hedged ("about 100", "more than 5", "up to 20") must keep a hedge of the same kind; a modal source sentence ("may", "usually",
// "reportedly") must leave some hedge in the sentence. Deterministic, and it runs before any judge call. It cannot see scope or conditions ("when properly stored"):
// those still rest on the judge, which now reads the whole source sentence.
const HEDGES: Record<string, string[]> = { approx: ['about', 'approximately', 'around', 'roughly', 'nearly', 'almost', 'estimated', 'circa', 'some'], lower: ['over', 'more than', 'at least', 'exceeding', 'upwards of'], upper: ['under', 'fewer than', 'less than', 'up to', 'at most', 'no more than'], modal: ['may', 'might', 'could', 'usually', 'often', 'typically', 'generally', 'reportedly', 'allegedly', 'probably', 'possibly', 'believed', 'thought', 'said to', 'likely', 'sometimes', 'mostly', 'mainly', 'largely', 'perhaps', 'claimed', 'estimated'] };
const hasWord = (text: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));
export function qualifierDropped(sentence: string, quote: string): string | null {
  const toks = quote.toLowerCase().split(/\s+/);
  for (const n of new Set(nums(sentence))) for (let i = 0; i < toks.length; i++) {
    if (nums(toks[i])[0] !== n) continue; const before = toks.slice(Math.max(0, i - 3), i).join(' ').replace(/[^a-z ]/g, ' ');
    for (const k of ['approx', 'lower', 'upper']) if (hasWord(before, HEDGES[k]) && !hasWord(sentence, HEDGES[k])) return `${k}:${n}`;
  }
  if (hasWord(quote, HEDGES.modal) && !hasWord(sentence, Object.values(HEDGES).flat())) return 'modal';
  return null;
}
// Two accepted sentences that say nearly the same thing (even citing different claims) are a repeat.
export function similar(a: string, b: string): boolean { const x = contentWords(a), y = contentWords(b); if (Math.min(x.size, y.size) < 3) return false; const inter = [...x].filter((w) => y.has(w)).length; return inter / (x.size + y.size - inter) >= 0.7; }
export function parseWrite(raw: string): { t: string; ids: string[] }[] {
  return raw.split('\n').map((l) => l.split('||')).filter((p) => p.length === 2 && p[0].trim()).map((p) => ({ t: p[0].trim(), ids: p[1].split(/[,\s]+/).map((x) => x.trim()).filter(Boolean) }));
}

export type Runners = {
  extract: (title: string, text: string, known?: string) => Promise<string>; outline: (prompt: string) => Promise<string>; write: (prompt: string) => Promise<string>;
  judge: (prompt: string) => Promise<string>; review: (prompt: string) => Promise<string>;
  note?: (msg: string) => void; reserve: (stage: string) => boolean; // false when the hard cap refuses; the pipeline must stop, not continue unchecked
};
export type Candidate = { title: string; paragraphs: string[]; sentences: string[][]; claimIds: string[]; sourceUrls: string[]; licenceFlags: string[]; label: string; status: 'candidate' };
export const LABEL = 'Written by AI from several sources. Each sentence was machine-checked against quoted source text. Not verified by a person and not independently proven.';

export async function runCandidate(title: string, sources: (Source & { text: string })[], run: Runners): Promise<{ outcome: Outcome; candidate?: Candidate }> {
  const fail = (reason: Rejection) => ({ outcome: { ok: false as const, reason } });
  const claims: Claim[] = []; let n = 0;
  for (const s of sources) {
    if (!run.reserve('extract')) return fail('cap_reached');
    let raw: string; try { raw = await run.extract(title, s.text, claims.slice(0, 40).map((c) => `${c.key} | ${c.value}`).join('\n')); } catch { return fail('provider_error'); }
    const parsed = parseExtract(raw); let kept = 0;
    for (const c of parsed) {
      if (c.quote.trim().split(/\s+/).length < MIN_QUOTE_WORDS || !quoteInSource(c.quote, s.text)) continue;
      const full = expandQuote(c.quote, s.text); if (!full || !valueInQuote(c.value, full)) continue; // the value must be in the source's own sentence, or it cannot corroborate anything
      kept++; claims.push({ id: `c${++n}`, sourceId: s.id, key: c.key, value: c.value, quote: full });
    }
    run.note?.(`${s.groupId} rawLen=${raw.length} parsed=${parsed.length} quoteKept=${kept} textLen=${s.text.length} rawHead=${JSON.stringify(raw.slice(0, 160))}`);
  }
  const groups = classifyClaims(sources, claims, title); const status = new Map<string, string>();
  const byClaim = new Map<string, string>(); for (const g of groups) for (const v of g.values) for (const id of v.claimIds) byClaim.set(id, g.status);
  if (!groups.some((g) => g.status === 'central')) return fail('too_few_sources'); // central means two independent, non-Wikipedia groups agree
  void status;
  const quotesOf = (ids: string[]) => ids.map((i) => claims.find((c) => c.id === i)).filter(Boolean).map((c) => `[${c!.id}] ${c!.quote}`).join('\n');
  // The writer must see each fact's status and publisher, or it cannot follow the 'single must say according to <publisher>' rule. The judge still gets bare quotes.
  // A disputed fact is only ever told with every side present: the writer is handed all claims under that key, and a sentence that cites one side alone is refused below.
  const keyIds = new Map(groups.map((g) => [g.key, g.values.flatMap((v) => v.claimIds)] as const));
  const withAllSides = (ids: string[]) => [...new Set(ids.flatMap((i) => { const c = claims.find((x) => x.id === i); return c && byClaim.get(i) === 'disputed' ? keyIds.get(c.key) ?? [i] : [i]; }))];
  const factsFor = (ids0: string[]) => withAllSides(ids0).map((i) => claims.find((c) => c.id === i)).filter(Boolean).map((c) => `[${c!.id}] (${byClaim.get(c!.id)}${byClaim.get(c!.id) === 'single' ? `; write "according to ${sources.find((x) => x.id === c!.sourceId)!.publisher}"` : ''}) ${c!.quote}`).join('\n');
  const ledger = claims.map((c) => `${c.id}: ${c.key} = ${c.value}, ${byClaim.get(c.id)}`).join('\n');
  run.note?.(`LEDGER ${claims.map((c) => `${c.id}:${c.key}=${c.value}:${byClaim.get(c.id)}`).join(' ; ').slice(0, 480)}`);
  if (!run.reserve('outline')) return fail('cap_reached');
  const plan = await run.outline(PROMPTS.outline(title, ledger, 'India')).catch(() => null); if (plan === null) return fail('provider_error'); run.note?.(`PLAN ${plan.slice(0, 480)}`);
  const paragraphs: string[] = []; const allSents: string[][] = []; const usedKeys = new Set<string>(); const keyPara = new Map<string, number>(); const usedClaims = new Set<string>(); const told: string[] = [];
  const claimOf = (i: string) => claims.find((c) => c.id === i)!; const publisherOf = (i: string) => sources.find((x) => x.id === claimOf(i).sourceId)!.publisher;
  for (const [pIdx, line] of plan.split('\n').filter((l) => /paragraph/i.test(l)).slice(0, 7).entries()) {
    const purpose = line.replace(/^paragraph \d+:\s*/i, '').split('|')[0].trim(); const ids = (line.split('|')[1] ?? '').split(/[,\s]+/).filter(Boolean);
    if (!run.reserve('write')) return fail('cap_reached');
    const raw = await run.write(PROMPTS.write(purpose, factsFor(ids), told.join(' ').slice(-1500))).catch(() => null); if (raw === null) return fail('provider_error');
    run.note?.(`WRITE ${raw.slice(0, 480)}`); const sents = parseWrite(raw); if (!sents.length) continue; const kept: string[] = []; const paraCited = new Set<string>();
    for (const s of sents) {
      const cited = s.ids.filter((i) => claims.some((c) => c.id === i)); const why = (w: string) => { const all: string[] = []; if (!cited.length) all.push('no_valid_citation'); if (cited.some((i) => byClaim.get(i) === 'single' && !attributed(s.t, publisherOf(i)))) all.push('single_not_attributed'); const qq = quotesOf(cited); const bad = nums(s.t).filter((x) => !nums(qq).includes(x)); if (bad.length) all.push('number_not_in_quotes:' + bad.join(',')); run.note?.(`REJECT first=${w} all=[${all.join(' | ')}] ids=${s.ids.join(',')} sentence=${s.t.slice(0, 220)} quotes=${qq.slice(0, 200)}`); return fail('unsupported_sentence'); }; if (!cited.length) return why('no_valid_citation');
      const sts = cited.map((i) => byClaim.get(i)!); const q = quotesOf(cited);
      if (sts.includes('disputed') && !DISAGREE.test(s.t)) return fail('disputed_stated_as_fact');      if (cited.some((i) => byClaim.get(i) === 'single' && !attributed(s.t, publisherOf(i)))) return why('single_not_attributed'); // single-source facts must be attributed to the source they came from
      if (nums(s.t).some((x) => !nums(q).includes(x))) return why('number_not_in_quotes ' + nums(s.t).filter((x) => !nums(q).includes(x)).join(','));
      const dropped = qualifierDropped(s.t, cited.map((i) => claimOf(i).quote).join('\n')); if (dropped) { run.note?.(`REJECT qualifier=${dropped} sentence=${s.t.slice(0, 200)}`); return fail('qualifier_dropped'); }
      const keys = cited.map((i) => claimOf(i).key);
      // A key may come back only when a disagreement is being told side by side: the key is disputed, it is the same paragraph, and this sentence cites a claim not used before.
      const sideBySide = (i: string) => byClaim.get(i) === 'disputed' && keyPara.get(claimOf(i).key) === pIdx && !usedClaims.has(i);
      if (cited.some((i) => usedKeys.has(claimOf(i).key) && !sideBySide(i)) || told.some((t) => similar(t, s.t))) return fail('repeated_fact'); // same question asked again, even via another source's claim id or in the same paragraph
      if (!run.reserve('judge')) return fail('cap_reached');
      const vraw = (await run.judge(PROMPTS.judge(s.t, q)).catch(() => 'error')); run.note?.(`JUDGE_RAW ${JSON.stringify(vraw.slice(0, 40))}`); const v = vraw === 'error' ? 'error' : verdict(vraw); // only case, whitespace, quotes and terminal punctuation are tolerated; 'Supported, but ...' is not the verdict
      if (v === 'error') return fail('provider_error'); if (v !== 'supported') { run.note?.(`JUDGE ${v.slice(0, 20)}: ${s.t.slice(0, 200)} // ${q.slice(0, 300)}`); return fail(v.startsWith('partly') ? 'qualifier_dropped' : 'unsupported_sentence'); }
      kept.push(s.t); cited.forEach((i) => { usedClaims.add(i); paraCited.add(i); }); keys.forEach((k) => { usedKeys.add(k); if (!keyPara.has(k)) keyPara.set(k, pIdx); }); told.push(s.t);
    }
    // Telling one side of a disagreement and stopping ("accounts differ, but it was 1873") is the dispute stated as fact: by the end of the paragraph every side must have been told.
    for (const i of paraCited) if (byClaim.get(i) === 'disputed' && !(keyIds.get(claimOf(i).key) ?? []).every((x) => paraCited.has(x))) return fail('disputed_stated_as_fact');
    paragraphs.push(kept.join(' ')); allSents.push(kept);
  }
  if (paragraphs.length < 5) return fail('rubric_failed');
  if (!run.reserve('review')) return fail('cap_reached');
  const rv = (await run.review(PROMPTS.review(paragraphs.join('\n\n'), quotesOf([...usedClaims]))).catch(() => null)); if (rv === null) return fail('provider_error');
  if (!/^none\.?$/i.test(rv.trim())) return fail('rubric_failed'); // an empty review is not "no defects": only an explicit "none" passes
  // Sources listed = every source whose claim agrees with a cited claim (that is what makes it corroborated), not only the ones the writer happened to cite.
  const agreeing = new Set<string>(); for (const g of groups) for (const v of g.values) if (v.claimIds.some((i) => usedClaims.has(i))) v.claimIds.forEach((i) => agreeing.add(i));
  const urls = [...new Set(claims.filter((c) => agreeing.has(c.id) || usedClaims.has(c.id)).map((c) => sources.find((s) => s.id === c.sourceId)!.url))];
  const usedSrc = [...new Set(claims.filter((c) => usedClaims.has(c.id)).map((c) => c.sourceId))];
  return { outcome: { ok: true }, candidate: { title, paragraphs, sentences: allSents, claimIds: [...usedClaims], sourceUrls: urls, licenceFlags: licenceFlags(sources, usedSrc), label: LABEL, status: 'candidate' } };
}
export { allowedPhrasing };
