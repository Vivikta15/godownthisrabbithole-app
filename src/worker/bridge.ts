// Connection Finder v2: a bridge through Wikipedia's own links.
// Sourced facts: page A links to page C and says something about it; page B links to the same C and says something about it.
// Both sentences are copied from the pages and must contain C's title. The model (optional) only PICKS among real candidate bridges and writes
// one clearly-labelled inference. It cannot add a bridge, a fact or a source.
import { guardedRun, type AiEnv } from './ai';
import { cleanWord } from './finder';
const UA = 'godownthisrabbithole/0.1 (https://rabbithole-app.godownthisrabbithole.workers.dev; small personal reading app)';
export type Page = { title: string; url: string; text: string; links: Set<string> };
export type Bridge = { via: string; sentA: string; sentB: string };
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
function sentenceWith(text: string, term: string): string | null {
  const re = new RegExp('(^|[^\\p{L}])' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\p{L}]|$)', 'iu');
  const hits = sentences(text).filter((s) => re.test(s)); return hits[0] ?? null;
}
export function candidates(a: Page, b: Page, max = 12): Bridge[] {
  const out: Bridge[] = [];
  for (const t of a.links) {
    if (!b.links.has(t) || generic(t) || t === a.title || t === b.title) continue;
    const base = t.replace(/ \(.*\)$/, ''); const sa = sentenceWith(a.text, base), sb = sentenceWith(b.text, base);
    if (sa && sb) out.push({ via: t, sentA: sa, sentB: sb });
  }
  // Salience: a topic both pages keep coming back to beats one mentioned in passing. Ties go to the more specific (longer) title.
  const count = (t: string, term: string) => (t.match(new RegExp('(^|[^\\p{L}])' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\p{L}]|$)', 'giu')) ?? []).length;
  const score = (x: Bridge) => { const base = x.via.replace(/ \(.*\)$/, ''); return Math.min(count(a.text, base), count(b.text, base)) * 100 + x.via.length; };
  return out.sort((x, y) => score(y) - score(x)).slice(0, max);
}
const SYS = 'You help pick the most surprising, interesting bridge between two Wikipedia pages from a numbered list of real candidates. Reply JSON only: {"pick": <number>, "take": "one short sentence of your own inference about why the link is interesting"}. Do not state new facts. If none is interesting reply {"pick":null}.';
export async function findBridge(env: AiEnv & { FINDER_MODEL?: string }, wa: string, wb: string, f: typeof fetch = fetch): Promise<BridgeResult & { aiUsed?: boolean }> {
  const a0 = cleanWord(wa), b0 = cleanWord(wb);
  if (!a0 || !b0) return { ok: false, reason: 'bad_words', message: 'Use plain words or short names, up to 40 characters each.' };
  let A: Page | null, B: Page | null;
  try { [A, B] = await Promise.all([loadPageCached(env.DB, a0, f), loadPageCached(env.DB, b0, f)]); } catch { return { ok: false, reason: 'wiki_error', message: 'Could not reach the source library just now. Try again in a moment.' }; }
  if (!A || !B) return { ok: false, reason: 'no_page', message: `I could not find a good source page for "${!A ? a0 : b0}". Try a more common name.` };
  const cands = candidates(A, B);
  if (!cands.length) return { ok: false, reason: 'no_bridge', message: `I could not find a specific, sourced bridge between ${A.title} and ${B.title}. Their pages do not point to the same specific topic, and I won't invent one.` };
  let pick = 0; let inference: string | null = null; let aiUsed = false;
  const list = cands.map((c, i) => `${i + 1}. ${c.via}`).join('\n');
  // The model's picks and one-line takes were poor in the benchmark, so it is OFF unless FINDER_USE_AI === 'true'.
  const r = (env as any).FINDER_USE_AI === 'true' ? await guardedRun(env, { model: env.FINDER_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast', system: SYS, prompt: `Page A: ${A.title}\nPage B: ${B.title}\nCandidates (topics both pages mention):\n${list}`, maxTokens: 120 }) : ({ ok: false } as any);
  if (r.ok) { aiUsed = true; try { const o = JSON.parse(r.text.match(/\{[\s\S]*\}/)![0]); const n = Number(o.pick); if (Number.isInteger(n) && n >= 1 && n <= cands.length) { pick = n - 1; if (typeof o.take === 'string' && o.take.length < 300) inference = o.take.trim(); } } catch { /* keep default pick, no inference */ } }
  const c = cands[pick];
  return { ok: true, aiUsed, a: { title: A.title, url: A.url }, b: { title: B.title, url: B.url }, bridge: c, inference, alternatives: cands.filter((_, i) => i !== pick).slice(0, 5).map((x) => x.via) };
}
