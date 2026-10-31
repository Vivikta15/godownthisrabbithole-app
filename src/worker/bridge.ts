// Connection Finder v2: a bridge through Wikipedia's own links.
// Sourced facts: page A links to page C and says something about it; page B links to the same C and says something about it.
// Both sentences are copied from the pages and must contain C's title. The model (optional) only PICKS among real candidate bridges and writes
// one clearly-labelled inference. It cannot add a bridge, a fact or a source.
import { guardedRun, type AiEnv } from './ai';
import { cleanWord } from './finder';
const UA = 'godownthisrabbithole/0.1 (https://rabbithole-app.godownthisrabbithole.workers.dev; small personal reading app)';
export type Page = { title: string; url: string; text: string; links: Set<string> };
export type Bridge = { via: string; sentA: string; sentB: string; kind?: 'shared' | 'direct' | 'chain'; from?: 'a' | 'b'; viaUrl?: string };
export type BridgeResult =
  | { ok: true; a: { title: string; url: string }; b: { title: string; url: string }; bridge: Bridge; inference: string | null; alternatives: string[] }
  | { ok: false; reason: 'bad_words' | 'no_page' | 'no_bridge' | 'wiki_error' | 'ai_unavailable'; message: string };

const HUBS = new Set(['earth', 'united states', 'united kingdom', 'england', 'france', 'germany', 'italy', 'spain', 'china', 'india', 'japan', 'russia', 'europe', 'asia', 'africa', 'north america', 'south america', 'australia', 'latin', 'english language', 'greek language', 'french language', 'german language', 'new york city', 'london', 'paris', 'world war ii', 'world war i', 'doi (identifier)', 'isbn (identifier)', 'wayback machine', 'wikipedia', 'wikimedia commons', 'bibcode (identifier)', 'jstor (identifier)', 'pmid (identifier)', 'oclc (identifier)', 'ancient greek', 'roman empire', 'ancient rome', 'middle ages', 'christianity', 'islam', 'united nations', 'european union', 'the new york times', 'bbc', 'encyclopædia britannica', 'oxford university press', 'cambridge university press', 'universe', 'sun', 'water', 'human', 'animal', 'plant', 'species', 'time', 'energy', 'science', 'history', 'culture', 'population', 'city', 'country', 'year', 'century', 'kilometre', 'metre', 'celsius', 'fahrenheit']);
const generic = (t: string) => HUBS.has(t.toLowerCase()) || /^\d{1,4}( bc| ad)?$/i.test(t) || /^(list of|category|\d+s?$)/i.test(t) || t.length < 4 || /\((identifier|disambiguation)\)/i.test(t);

const api = (q: string) => 'https://en.wikipedia.org/w/api.php?format=json&redirects=1&' + q;
async function wget(f: typeof fetch, u: string): Promise<any> {
  let r = await f(u, { headers: { 'user-agent': UA } });
  if (r.status === 429 || r.status === 503) { await new Promise((x) => setTimeout(x, 900)); r = await f(u, { headers: { 'user-agent': UA } }); }
  if (!r.ok) throw new Error('wiki ' + r.status);
  return r.json();
}
const TTL = 7 * 86400000;
// Pages are cached in D1 for 7 days (Wikipedia 429s shared Cloudflare IPs under bursts). Cache is best-effort.
export async function loadPageCached(db: any, word: string, f: typeof fetch = fetch): Promise<Page | null> {
  const key = 'page:' + word.toLowerCase();
  try { const row = await db.prepare('SELECT text,fetched_at FROM extract_cache WHERE word=?').bind(key).first(); if (row && Date.now() - row.fetched_at < TTL) { const o = JSON.parse(row.text); return { title: o.title, url: o.url, text: o.text, links: new Set<string>(o.links) }; } } catch { /* ignore */ }
  const p = await loadPage(word, f);
  if (p) { try { await db.prepare('INSERT OR REPLACE INTO extract_cache (word,title,url,text,fetched_at) VALUES (?,?,?,?,?)').bind(key, p.title, p.url, JSON.stringify({ title: p.title, url: p.url, text: p.text, links: [...p.links] }), Date.now()).run(); } catch { /* ignore */ } }
  return p;
}
export async function loadPage(word: string, f: typeof fetch = fetch): Promise<Page | null> {
  const s = await wget(f, api('action=query&list=search&srlimit=1&srsearch=' + encodeURIComponent(word)));
  const title: string | undefined = s?.query?.search?.[0]?.title; if (!title) return null;
  const links = new Set<string>(); let text = ''; let cont = ''; let tries = 0;
  do {
    const j = await wget(f, api('action=query&prop=links|extracts&explaintext=1&pllimit=max&plnamespace=0&titles=' + encodeURIComponent(title) + cont));
    const p: any = Object.values(j?.query?.pages ?? {})[0]; if (!p) break;
    for (const l of p.links ?? []) links.add(l.title);
    if (p.extract && !text) text = String(p.extract);
    cont = j?.continue?.plcontinue ? '&plcontinue=' + encodeURIComponent(j.continue.plcontinue) : '';
  } while (cont && ++tries < 3);
  if (text.length < 200) return null;
  return { title, url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')), text, links };
}
export const sentences = (t: string) => t.replace(/=+\s*[^=\n]{1,80}?\s*=+/g, '\n').split(/\n+/).flatMap((para) => para.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z"“])/)).map((x) => x.trim()).filter((x) => x.length >= 40 && x.length <= 400);
// Workers Free allows only 10 ms CPU per request; per-term unicode regexes over these texts cost ~1 ms each
// and got the Worker killed (Cloudflare 1102) on link-heavy pages. Plain-ASCII terms are matched on folded text
// with indexOf + boundary checks instead: ~30x cheaper and exactly equivalent. foldText is per-code-unit and
// length-preserving: it lowercase-folds A-Z and the only two characters whose unicode case fold lands in ASCII
// (U+017F long s -> s, U+212A kelvin -> k), so it canonicalizes exactly like the /iu regexes did for ASCII terms,
// and letter-ness of every other character is unchanged. Non-ASCII terms keep the original regex path.
const foldText = (t: string) => t.replace(/[A-Z\u017F\u212A]/g, (c) => (c === '\u017F' ? 's' : c === '\u212A' ? 'k' : c.toLowerCase()));
const LETTER = /\p{L}/u;
// Codepoint-aware: an astral letter (surrogate pair) at the boundary must read as a letter, matching the
// old /iu regexes, which evaluate whole code points. Testing a lone surrogate half would wrongly allow adjacency.
const isLetterAt = (t: string, i: number) => {
  if (i < 0 || i >= t.length) return false;
  const c = t.charCodeAt(i);
  const start = c >= 0xdc00 && c <= 0xdfff && i > 0 && (t.charCodeAt(i - 1) & 0xfc00) === 0xd800 ? i - 1 : i;
  return LETTER.test(String.fromCodePoint(t.codePointAt(start)!));
};
const ASCII_ONLY = /^[\x00-\x7F]*$/;
const escRx = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const boundaryRx = (base: string, plural = false) => new RegExp('(^|[^\\p{L}])' + escRx(base) + (plural ? '(s|es)?' : '') + '([^\\p{L}]|$)', 'iu');
// First sentence containing `base` as a standalone phrase; same result as the old per-sentence regex scan.
function sentenceInFolded(orig: string[], folded: string[], base: string, plural = false): string | null {
  if (!ASCII_ONLY.test(base)) {
    const re = boundaryRx(base, plural);
    const i = orig.findIndex((s) => re.test(s));
    return i === -1 ? null : orig[i];
  }
  const f = foldText(base);
  for (let s = 0; s < folded.length; s++) {
    const t = folded[s];
    let j = -1;
    while ((j = t.indexOf(f, j + 1)) !== -1) {
      if (isLetterAt(t, j - 1)) continue;
      const r = j + f.length;
      if (!plural) { if (!isLetterAt(t, r)) return orig[s]; continue; }
      if (!isLetterAt(t, r)) return orig[s];
      if (t[r] === 's' && !isLetterAt(t, r + 1)) return orig[s];
      if (t[r] === 'e' && t[r + 1] === 's' && !isLetterAt(t, r + 2)) return orig[s];
    }
  }
  return null;
}
// Occurrence count equivalent to the old /(^|[^\p{L}])base([^\p{L}]|$)/giu match().length for word terms:
// a successful match consumes its trailing delimiter, so an occurrence beginning immediately after that
// delimiter is not counted. Known low-stakes divergence, kept deliberately: for numeric-ish terms (e.g. "11"
// in "a111") delimiter-consumption ordering can differ by one overlap; it only shifts salience ordering of
// rare numeric candidates, and generic() already drops plain years/numbers.
function countFolded(lt: string, f: string): number {
  let n = 0, last = 0;
  for (;;) {
    const j = lt.indexOf(f, last);
    if (j === -1) return n;
    const leftOk = j === 0 ? last === 0 : j - 1 >= last && !isLetterAt(lt, j - 1);
    const r = j + f.length;
    const rightOk = r >= lt.length || !isLetterAt(lt, r);
    if (leftOk && rightOk) { n++; last = r + (r < lt.length ? 1 : 0); } else { last = j + 1; }
  }
}
export function candidates(a: Page, b: Page, max = 12): Bridge[] {
  // Split and fold each page once: the old version re-split both texts and compiled fresh unicode regexes for
  // every shared link, which cost over a second of CPU on link-heavy pages and got the Worker killed (1102).
  const sentsA = sentences(a.text), sentsB = sentences(b.text);
  const foldA = sentsA.map(foldText), foldB = sentsB.map(foldText);
  const lowA = foldText(a.text), lowB = foldText(b.text);
  // Whitespace-normalized folds: every kept sentence is a substring of these, so a missing term cannot
  // appear in any sentence and the sentence scan below can be skipped for it (exact, not heuristic).
  const normA = foldText(a.text.replace(/\s+/g, ' ')), normB = foldText(b.text.replace(/\s+/g, ' '));
  const out: Bridge[] = [];
  for (const t of a.links) {
    if (!b.links.has(t) || generic(t) || t === a.title || t === b.title) continue;
    const base = t.replace(/ \(.*\)$/, '');
    if (ASCII_ONLY.test(base) && (!normA.includes(foldText(base)) || !normB.includes(foldText(base)))) continue;
    const sa = sentenceInFolded(sentsA, foldA, base);
    if (!sa) continue;
    const sb = sentenceInFolded(sentsB, foldB, base);
    if (sa && sb) out.push({ via: t, sentA: sa, sentB: sb });
  }
  // Salience: a topic both pages keep coming back to beats one mentioned in passing. Ties go to the more specific (longer) title.
  // Non-ASCII terms keep the original regex count: foldText only folds into ASCII, so their folded counts would diverge.
  const count = (text: string, low: string, base: string) => ASCII_ONLY.test(base) ? countFolded(low, foldText(base)) : (text.match(new RegExp('(^|[^\\p{L}])' + escRx(base) + '([^\\p{L}]|$)', 'giu')) ?? []).length;
  const score = (x: Bridge) => { const base = x.via.replace(/ \(.*\)$/, ''); return Math.min(count(a.text, lowA, base), count(b.text, lowB, base)) * 100 + x.via.length; };
  return out.sort((x, y) => score(y) - score(x)).slice(0, max);
}

// Topics that "connect" almost any two pages and are rarely interesting: language roots, basic science words, calendar words.
const BORING = /^(proto-|old |middle |ancient |classical |medieval |latin|greek|sanskrit|arabic|french|german|english|spanish|italian|chinese|japanese|hindi|persian|dutch|russian|turkish|portuguese|language|etymology|word|name|history|culture|society|science|technology|chemistry|physics|biology|mathematics|density|convection|weather|nitrogen|oxygen|carbon|hydrogen|water|energy|heat|temperature|pressure|gas|liquid|solid|metal|mass|volume|speed|time|year|month|day|century|millennium|species|animal|plant|human|people|population|city|town|village|country|capital|ocean|sea|river|island|mountain|climate|season|summer|winter|spring|autumn|period|era|age|empire|dynasty|religion|christianity|islam|buddhism|hinduism)\b/i;
export const boring = (t: string) => { const b = t.replace(/ \(.*\)$/, ''); return BORING.test(b) || /\b(period|era|age|empire|dynasty|languages?)$/i.test(b); };
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const baseOf = (t: string) => t.replace(/ \(.*\)$/, '');
// A page that says the other page's subject in one of its own sentences ("the Moon page mentions cheese").
export function directMention(from: Page, other: Page): string | null {
  const base = baseOf(other.title); if (base.length < 4 || generic(other.title)) return null;
  const sents = sentences(from.text);
  return sentenceInFolded(sents, sents.map(foldText), base, true);
}
// Two-step route: the source page names a topic C in one sentence, and C's own page names the target in another.
async function chainVia(db: any, from: Page, other: Page, f: typeof fetch): Promise<Bridge | null> {
  const fromSents = sentences(from.text); // split and fold once, not per link: same CPU blow-up as candidates()
  const fromFolded = fromSents.map(foldText);
  const lowFrom = foldText(from.text);
  const count = (term: string) => ASCII_ONLY.test(term) ? countFolded(lowFrom, foldText(term)) : (from.text.match(new RegExp('(^|[^\\p{L}])' + esc(term) + '([^\\p{L}]|$)', 'giu')) ?? []).length;
  const cands = [...from.links].filter((t) => !generic(t) && !boring(t) && t !== from.title && t !== other.title && sentenceInFolded(fromSents, fromFolded, baseOf(t)))
    .map((t) => ({ t, n: count(baseOf(t)) })).sort((x, y) => y.n - x.n || y.t.length - x.t.length).slice(0, 18).map((x) => x.t);
  if (!cands.length) return null;
  let j: any; try { j = await wget(f, api('action=query&prop=extracts&exintro=1&explaintext=1&exlimit=max&titles=' + encodeURIComponent(cands.join('|')))); } catch { return null; }
  const pages: any[] = Object.values(j?.query?.pages ?? {});
  const re = new RegExp('(^|[^\\p{L}])' + esc(baseOf(other.title)) + '(s|es)?([^\\p{L}]|$)', 'iu');
  for (const t of cands) {
    const pg = pages.find((p) => p.title === t); if (!pg?.extract) continue;
    const hit = sentences(String(pg.extract)).find((x) => re.test(x) && x.length < 420); if (!hit) continue;
    return { via: t, sentA: sentenceInFolded(fromSents, fromFolded, baseOf(t))!, sentB: hit, kind: 'chain', viaUrl: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_')) };
  }
  return null;
}
const SYS = 'You help pick the most surprising, interesting bridge between two Wikipedia pages from a numbered list of real candidates. Reply JSON only: {"pick": <number>, "take": "one short sentence of your own inference about why the link is interesting"}. Do not state new facts. If none is interesting reply {"pick":null}.';
export async function findBridge(env: AiEnv & { FINDER_MODEL?: string }, wa: string, wb: string, f: typeof fetch = fetch): Promise<BridgeResult & { aiUsed?: boolean }> {
  const a0 = cleanWord(wa), b0 = cleanWord(wb);
  if (!a0 || !b0) return { ok: false, reason: 'bad_words', message: 'Use plain words or short names, up to 40 characters each.' };
  let A: Page | null, B: Page | null;
  try { [A, B] = await Promise.all([loadPageCached(env.DB, a0, f), loadPageCached(env.DB, b0, f)]); } catch { return { ok: false, reason: 'wiki_error', message: 'Could not reach the source library just now. Try again in a moment.' }; }
  if (!A || !B) return { ok: false, reason: 'no_page', message: `I could not find a good source page for "${!A ? a0 : b0}". Try a more common name.` };
  const all = candidates(A, B);
  const goodShared = all.filter((x) => !boring(x.via)).map((x) => ({ ...x, kind: 'shared' as const }));
  const dAB = directMention(A, B), dBA = directMention(B, A);
  const direct: Bridge[] = [];
  if (dAB) direct.push({ via: B.title, sentA: dAB, sentB: '', kind: 'direct', from: 'a' });
  if (dBA) direct.push({ via: A.title, sentA: dBA, sentB: '', kind: 'direct', from: 'b' });
  let cands: Bridge[] = [...direct, ...goodShared];
  if (!cands.length) { const c1 = await chainVia(env.DB, A, B, f); const c2 = c1 ? null : await chainVia(env.DB, B, A, f); const c = c1 || (c2 && { ...c2, from: 'b' as const }); if (c) cands = [{ ...c, from: c.from ?? 'a' }]; }
  if (!cands.length) cands = all.map((x) => ({ ...x, kind: 'shared' as const }));
  if (!cands.length) return { ok: false, reason: 'no_bridge', message: `I could not find a specific, sourced bridge between ${A.title} and ${B.title}. Their pages do not point to the same specific topic, and I won't invent one.` };
  let pick = 0; let inference: string | null = null; let aiUsed = false;
  const list = cands.map((c, i) => `${i + 1}. ${c.via}`).join('\n');
  // The model's picks and one-line takes were poor in the benchmark, so it is OFF unless FINDER_USE_AI === 'true'.
  const r = (env as any).FINDER_USE_AI === 'true' ? await guardedRun(env, { model: env.FINDER_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast', system: SYS, prompt: `Page A: ${A.title}\nPage B: ${B.title}\nCandidates (topics both pages mention):\n${list}`, maxTokens: 120 }) : ({ ok: false } as any);
  if (r.ok) { aiUsed = true; try { const o = JSON.parse(r.text.match(/\{[\s\S]*\}/)![0]); const n = Number(o.pick); if (Number.isInteger(n) && n >= 1 && n <= cands.length) { pick = n - 1; if (typeof o.take === 'string' && o.take.length < 300) inference = o.take.trim(); } } catch { /* keep default pick, no inference */ } }
  const c = cands[pick];
  return { ok: true, aiUsed, a: { title: A.title, url: A.url }, b: { title: B.title, url: B.url }, bridge: c, inference, alternatives: cands.filter((_, i) => i !== pick).slice(0, 5).map((x) => x.via) };
}
