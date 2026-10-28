// Candidate-story pipeline with injected runners. Preparation: the runners here are fixtures; no model is called and nothing is wired.
// Fixture tests show the orchestration and the refusal rules work. They do NOT show that a model writes good or true stories.
import { classifyClaims, allowedPhrasing, licenceFlags, type Source, type Claim, type Outcome, type Rejection } from './ledger';

export const PROMPTS = {
  // Output format: one claim per line "key | value | exact quote". The quote must be copied from the source text.
  extract: (title: string, text: string) => `You are extracting facts from one source about "${title}". Output one line per fact: key | value | exact quote copied from the text. Use short snake_case keys such as start_year or boxes_per_day. Use the same key for the same question across sources. Only facts stated in the text. No placeholders, no commentary.\n\nSOURCE TEXT:\n${text}`,
  outline: (title: string, ledger: string, country: string) => `Plan a 7 paragraph story about "${title}" for a curious reader in ${country}. Start from something the reader already knows. Use only these facts (id: key = value, status):\n${ledger}\nOutput 7 lines "paragraph N: purpose | fact ids". Where a fact is marked disputed, give it its own paragraph that says accounts differ. Do not plan trivia.`,
  write: (purpose: string, facts: string) => `Write one paragraph (3 to 5 sentences) for this purpose: ${purpose}. Use only these facts and cite each sentence. Output lines "sentence || fact ids". Facts marked "single" must say "according to <publisher>". Facts marked "disputed" may only appear as "accounts differ". Keep every qualifier in the source (such as "about", "usually", "may"). Never invent. Never repeat a fact used in an earlier paragraph.\n${facts}`,
  // Same shape as the benchmarked judge (scripts/judge-bench-paid.mjs) and the canary. The system prompt is JUDGE_SYSTEM in src/worker/judge.ts. Answers SUPPORTED, PARTLY or NOT.
  judge: (claim: string, quotes: string) => `SOURCE:\n"""${quotes}"""\n\nCLAIM: ${claim}\n\nOne word:`,
  review: (story: string, quotes: string) => `Find defects in this story against the quotes: dropped qualifiers, overclaims, a disputed fact stated plainly, repeated facts across paragraphs, trivia, abrupt jumps. Output "none" or one defect per line.\nQUOTES:\n${quotes}\nSTORY:\n${story}`,
};

export const DISAGREE = /\b(accounts differ|sources differ|disagree|disputed|not agreed)\b/i;
const nums = (s: string) => (s.match(/\d[\d,.]*/g) ?? []).map((x) => x.replace(/[,.]+$/, '').replace(/,/g, ''));
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function parseExtract(raw: string): { key: string; value: string; quote: string }[] {
  return raw.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p.length >= 3 && p[0] && p[1] && p[2] && !/^(key|fact|none)$/i.test(p[0])).map((p) => ({ key: p[0], value: p[1], quote: p.slice(2).join('|').trim() }));
}
// A claim is kept only if its quote really occurs in the source text it came from.
export const quoteInSource = (quote: string, text: string) => squash(text).includes(squash(quote));
export function parseWrite(raw: string): { t: string; ids: string[] }[] {
  return raw.split('\n').map((l) => l.split('||')).filter((p) => p.length === 2 && p[0].trim()).map((p) => ({ t: p[0].trim(), ids: p[1].split(/[,\s]+/).map((x) => x.trim()).filter(Boolean) }));
}

export type Runners = {
  extract: (title: string, text: string) => Promise<string>; outline: (prompt: string) => Promise<string>; write: (prompt: string) => Promise<string>;
  judge: (prompt: string) => Promise<string>; review: (prompt: string) => Promise<string>;
  note?: (msg: string) => void; reserve: (stage: string) => boolean; // false when the hard cap refuses; the pipeline must stop, not continue unchecked
};
export type Candidate = { title: string; paragraphs: string[]; claimIds: string[]; sourceUrls: string[]; licenceFlags: string[]; label: string; status: 'candidate' };
export const LABEL = 'Written by AI from several sources. Each sentence was machine-checked against quoted source text. Not verified by a person and not independently proven.';

export async function runCandidate(title: string, sources: (Source & { text: string })[], run: Runners): Promise<{ outcome: Outcome; candidate?: Candidate }> {
  const fail = (reason: Rejection) => ({ outcome: { ok: false as const, reason } });
  const claims: Claim[] = []; let n = 0;
  for (const s of sources) {
    if (!run.reserve('extract')) return fail('cap_reached');
    let raw: string; try { raw = await run.extract(title, s.text); } catch { return fail('provider_error'); }
    const parsed = parseExtract(raw); let kept = 0;
    for (const c of parsed) if (quoteInSource(c.quote, s.text)) { kept++; claims.push({ id: `c${++n}`, sourceId: s.id, key: c.key, value: c.value, quote: c.quote }); }
    run.note?.(`${s.groupId} rawLen=${raw.length} parsed=${parsed.length} quoteKept=${kept} textLen=${s.text.length} rawHead=${JSON.stringify(raw.slice(0, 160))}`);
  }
  const groups = classifyClaims(sources, claims); const status = new Map<string, string>();
  const byClaim = new Map<string, string>(); for (const g of groups) for (const v of g.values) for (const id of v.claimIds) byClaim.set(id, g.status);
  if (!groups.some((g) => g.status === 'central') || new Set(claims.map((c) => sources.find((s) => s.id === c.sourceId)!.groupId)).size < 2) return fail('too_few_sources');
  void status;
  const quotesOf = (ids: string[]) => ids.map((i) => claims.find((c) => c.id === i)).filter(Boolean).map((c) => `[${c!.id}] ${c!.quote}`).join('\n');
  const ledger = claims.map((c) => `${c.id}: ${c.key} = ${c.value}, ${byClaim.get(c.id)}`).join('\n');
  if (!run.reserve('outline')) return fail('cap_reached');
  const plan = await run.outline(PROMPTS.outline(title, ledger, 'India')).catch(() => null); if (plan === null) return fail('provider_error');
  const paragraphs: string[] = []; const used = new Set<string>(); const usedClaims = new Set<string>();
  for (const line of plan.split('\n').filter((l) => /paragraph/i.test(l))) {
    const purpose = line.replace(/^paragraph \d+:\s*/i, '').split('|')[0].trim(); const ids = (line.split('|')[1] ?? '').split(/[,\s]+/).filter(Boolean);
    if (!run.reserve('write')) return fail('cap_reached');
    const raw = await run.write(PROMPTS.write(purpose, quotesOf(ids))).catch(() => null); if (raw === null) return fail('provider_error');
    const sents = parseWrite(raw); if (!sents.length) continue; const kept: string[] = [];
    for (const s of sents) {
      const cited = s.ids.filter((i) => claims.some((c) => c.id === i)); if (!cited.length) return fail('unsupported_sentence');
      const sts = cited.map((i) => byClaim.get(i)!); const q = quotesOf(cited);
      if (sts.includes('disputed') && !DISAGREE.test(s.t)) return fail('disputed_stated_as_fact');
      if (sts.includes('single') && !/according to|\bsays\b/i.test(s.t)) return fail('unsupported_sentence'); // single-source facts must be attributed
      if (nums(s.t).some((x) => !nums(q).includes(x))) return fail('unsupported_sentence');
      if (cited.some((i) => used.has(i))) return fail('repeated_fact');
      if (!run.reserve('judge')) return fail('cap_reached');
      const v = (await run.judge(PROMPTS.judge(s.t, q)).catch(() => 'error')).trim().toLowerCase();
      if (v === 'error') return fail('provider_error'); if (v !== 'supported') return fail(v.startsWith('partly') ? 'qualifier_dropped' : 'unsupported_sentence');
      kept.push(s.t); cited.forEach((i) => usedClaims.add(i));
    }
    sents.forEach((s) => s.ids.forEach((i) => used.add(i))); paragraphs.push(kept.join(' '));
  }
  if (paragraphs.length < 5) return fail('rubric_failed');
  if (!run.reserve('review')) return fail('cap_reached');
  const rv = (await run.review(PROMPTS.review(paragraphs.join('\n\n'), quotesOf([...usedClaims]))).catch(() => null)); if (rv === null) return fail('provider_error');
  if (rv.trim() && !/^none\.?$/i.test(rv.trim())) return fail('rubric_failed');
  // Sources listed = every source whose claim agrees with a cited claim (that is what makes it corroborated), not only the ones the writer happened to cite.
  const agreeing = new Set<string>(); for (const g of groups) for (const v of g.values) if (v.claimIds.some((i) => usedClaims.has(i))) v.claimIds.forEach((i) => agreeing.add(i));
  const urls = [...new Set(claims.filter((c) => agreeing.has(c.id) || usedClaims.has(c.id)).map((c) => sources.find((s) => s.id === c.sourceId)!.url))];
  const usedSrc = [...new Set(claims.filter((c) => usedClaims.has(c.id)).map((c) => c.sourceId))];
  return { outcome: { ok: true }, candidate: { title, paragraphs, claimIds: [...usedClaims], sourceUrls: urls, licenceFlags: licenceFlags(sources, usedSrc), label: LABEL, status: 'candidate' } };
}
export { allowedPhrasing };
