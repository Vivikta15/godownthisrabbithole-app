// Free source acquisition: the Wikipedia article plus up to two independent external pages from that article's own reference links.
// Only public https pages on ordinary hostnames, size-capped. Independence is by registrable host. Wikipedia and anything that looks like a copy of it never counts as a second source.
import type { Source } from './ledger';
import { apiUrl, parseExtract } from '../content/wikipedia';
export const UA = 'godownthisrabbithole/0.1 (small personal reading app; https://rabbithole-app.godownthisrabbithole.workers.dev)';
export type Doc = Source & { text: string; revisionId?: number };
export const MAX_DOC_CHARS = 9000, MIN_EXT_CHARS = 1500;
const BAD_HOST = /(^|\.)(wikipedia|wikiwand|dbpedia|alchetron|infogalactic|justapedia|wikimili|everybodywiki|kiddle|wikimedia|wikidata|wikisource|wikibooks|archive|doi|worldcat|jstor|google|youtube|facebook|twitter|x|instagram|amazon|reddit|pinterest|linkedin|blogspot|wordpress|medium|quora|tumblr|substack|fandom|wikia|wixsite|weebly|tripadvisor|slideshare|scribd|blogger)\.(org|com|net|co|be)$/i;
const SECOND_LEVEL = new Set(['co', 'ac', 'gov', 'org', 'com', 'edu', 'nic', 'net']);
export function registrable(host: string): string { const p = host.toLowerCase().split('.'); return p.length >= 3 && SECOND_LEVEL.has(p[p.length - 2]) ? p.slice(-3).join('.') : p.slice(-2).join('.'); }
export function usableRef(u: string): string | null {
  let x: URL; try { x = new URL(u); } catch { return null; }
  if (x.protocol !== 'https:' || x.port || x.username || x.password) return null;
  const h = x.hostname.toLowerCase(); if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || BAD_HOST.test(h)) return null;
  if (/\.(pdf|jpg|png|gif|zip|mp3|mp4)(\?|$)/i.test(x.pathname)) return null; return x.toString();
}
export function htmlToText(html: string): string {
  return html.replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ').replace(/<(script|style|noscript|svg)\b(?![^>]*\/>)(?:(?!<\/\1\s*>)[\s\S])*$/i, ' ').replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8217;/g, "'").replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
// Article body first: sites wrap the story in <article> or <main> and put menus, tickers and trending lists around it in plain divs. Take the longest such block when it holds enough text on its own;
// otherwise fall back to the whole page, so a site without those tags behaves as before.
export function bodyText(html: string): string {
  // Outermost blocks only, matched by depth: an <article> can hold a related-story <article>, and ending at the first </article> would silently drop the rest of the story.
  const longest = (tag: string) => { let best = '', depth = 0, start = 0; for (const m of html.matchAll(new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi'))) { if (m[1]) { if (depth > 0 && --depth === 0) { const t = htmlToText(html.slice(start, m.index)); if (t.length > best.length) best = t; } } else if (depth++ === 0) start = m.index! + m[0].length; } return best; };
  // <article> and <main> are gathered separately (a <main> that wraps an <article> must not hide it). A qualifying article wins, then a qualifying main, then the page.
  const art = longest('article'); if (art.length >= MIN_EXT_CHARS) return art; const main = longest('main'); return main.length >= MIN_EXT_CHARS ? main : htmlToText(html);
}
const kw = (title: string) => title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
export const mentionsTopic = (text: string, title: string) => { const t = text.toLowerCase(); const k = kw(title); return k.length === 0 || k.some((w) => t.includes(w)); };

export async function wikiDoc(title: string, f: typeof fetch = fetch): Promise<Doc | null> {
  const url = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'));
  const r = await f(apiUrl(title), { headers: { 'user-agent': UA } }); if (!r.ok) return null; const d = parseExtract(await r.json(), url); if (!d) return null;
  return { id: 'wp', url, publisher: 'Wikipedia', license: 'cc-by-sa', groupId: 'wikipedia', text: d.text.slice(0, MAX_DOC_CHARS), revisionId: d.revisionId };
}
export async function refCandidates(title: string, f: typeof fetch = fetch): Promise<string[]> {
  const r = await f('https://en.wikipedia.org/w/api.php?action=query&prop=extlinks&ellimit=200&format=json&formatversion=2&redirects=1&titles=' + encodeURIComponent(title), { headers: { 'user-agent': UA } }); if (!r.ok) return [];
  const j: any = await r.json(); const links: string[] = (j?.query?.pages?.[0]?.extlinks ?? []).map((x: any) => x.url).filter((u: any) => typeof u === 'string');
  const seen = new Set<string>(); const out: string[] = [];
  for (const u of links) { const ok = usableRef(u); if (!ok) continue; const g = registrable(new URL(ok).hostname); if (seen.has(g)) continue; seen.add(g); out.push(ok); }
  return out;
}
export async function fetchExternal(url: string, title: string, id: string, f: typeof fetch = fetch): Promise<Doc | null> {
  try {
    const r = await f(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow' }); if (!r.ok) return null;
    const ct = r.headers.get('content-type') || ''; if (!/text\/html|text\/plain/i.test(ct)) return null;
    const final = usableRef(r.url || url); if (!final) return null;
    const raw = (await r.text()).slice(0, 2_000_000); const text = bodyText(raw).slice(0, MAX_DOC_CHARS);
    if (text.length < MIN_EXT_CHARS || !mentionsTopic(text, title)) return null;
    const host = new URL(final).hostname; return { id, url: final, publisher: registrable(host), license: 'unknown', groupId: registrable(host), text };
  } catch { return null; }
}
// A different host is not proof of a different author: mirrors and syndicated copies repeat the same text. Two documents sharing a third or more of their 8-word runs count as copies.
const shingles = (t: string, k = 8) => { const w = t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' '); const s = new Set<string>(); for (let i = 0; i + k <= w.length; i++) s.add(w.slice(i, i + k).join(' ')); return s; };
export function copyOf(a: string, b: string, minShare = 0.35): boolean {
  const x = shingles(a), y = shingles(b), small = x.size <= y.size ? x : y, big = small === x ? y : x; if (small.size < 5) return false;
  let n = 0; for (const g of small) if (big.has(g)) n++; return n / small.size >= minShare;
}
// Returns [wikipedia, ...up to 2 independent externals]. At most maxFetches external attempts, so the step stays under the subrequest budget.
export async function acquireSources(title: string, f: typeof fetch = fetch, maxFetches = 5): Promise<Doc[] | null> {
  const w = await wikiDoc(title, f); if (!w) return null;
  const cands = await refCandidates(title, f); const docs: Doc[] = [w]; let n = 0;
  for (const u of cands) { if (docs.length >= 3 || n >= maxFetches) break; n++; const d = await fetchExternal(u, title, 'x' + docs.length, f); if (d && !docs.some((x) => x.groupId === d.groupId || copyOf(x.text, d.text))) docs.push(d); }
  return docs;
}
