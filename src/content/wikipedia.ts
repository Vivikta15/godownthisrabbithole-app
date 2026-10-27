// Source fetcher for the content pipeline: English Wikipedia only, via the MediaWiki Action API (extracts as plain text + revision id).
// Only https://en.wikipedia.org/wiki/<Title> URLs are accepted (no arbitrary fetching = no SSRF). Wikipedia text is CC BY-SA 4.0: keep the link and revision.
// Wikipedia is a tertiary source and can be wrong or vandalised: a claim supported by it is "consistent with Wikipedia at revision N", not proven true.
import type { Fetcher, SourceDoc } from './pipeline';

export function titleFromUrl(url: string): string | null {
  let u: URL; try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' || u.hostname !== 'en.wikipedia.org' || !u.pathname.startsWith('/wiki/')) return null;
  const t = decodeURIComponent(u.pathname.slice('/wiki/'.length));
  return t && !t.includes(':') ? t : null; // no Special:/File:/Talk: pages
}
export const apiUrl = (title: string) => 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts%7Crevisions&explaintext=1&exsectionformat=plain&rvprop=ids%7Ctimestamp&format=json&formatversion=2&redirects=1&titles=' + encodeURIComponent(title);

export function parseExtract(json: any, url: string, now = Date.now()): (SourceDoc & { revisionId: number; title: string }) | null {
  const page = json?.query?.pages?.[0];
  if (!page || page.missing || typeof page.extract !== 'string' || !page.extract.trim()) return null;
  const rev = page.revisions?.[0]?.revid;
  if (typeof rev !== 'number') return null;
  return { url, fetchedAt: now, text: page.extract, revisionId: rev, title: String(page.title) };
}

export function wikipediaFetcher(fetchFn: typeof fetch = fetch): Fetcher {
  return {
    async fetch(url) {
      const title = titleFromUrl(url); if (!title) return null;
      const r = await fetchFn(apiUrl(title), { headers: { 'user-agent': 'godownthisrabbithole/0.1 (personal project; contact via repo owner)' } });
      if (!r.ok) return null;
      return parseExtract(await r.json(), url);
    },
  };
}
