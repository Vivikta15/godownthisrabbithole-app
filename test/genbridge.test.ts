import { describe, it, expect } from 'vitest';
import { cachedFetch, packFetched, MAX_ROW_BYTES, MAX_FETCH_CHARS, type Ctx } from '../src/worker/genrun';
import { fetchExternal, bodyText } from '../src/gen/source';
const ARTICLE = Array.from({ length: 40 }, (_, i) => `<p>Sentence ${i} about the Zorbat festival says the festival began in the year ${1800 + i} in the old town square.</p>`).join('');
const NAV = '<div class="menu">' + Array.from({ length: 16000 }, (_, i) => `<a href="/s${i}">Section ${i} trending ticker</a>`).join('') + '</div>';
const page = (head: string, art: string, tag = 'article') => `<html><head><title>Zorbat festival</title></head><body>${head}<${tag} class="story"><h1>Zorbat festival</h1>${art}</${tag}><div>Related: trending now</div></body></html>`;
function ctxFor(html: string, rows: number[] = []): Ctx {
  const fetchFn = (async () => ({ ok: true, status: 200, url: 'https://news.example.com/zorbat', headers: { get: () => 'text/html' }, text: async () => html })) as any;
  return { env: { DB: { prepare: () => ({ bind: (_a: any, _k: string, v: string) => ({ run: async () => { rows.push(new TextEncoder().encode(v).length); } }) }) } } as any, fetchFn, cache: new Map(), used: 0, max: 100, yielded: false, stop: null, micro: 0, calls: 0, diag: [], attemptId: 't', kind: 'k' };
}
describe('production bridge: byte-bounded cache and article body first', () => {
  it('a story that sits behind a very large page head is reached through the real bridge', async () => {
    const html = page(NAV, ARTICLE); expect(html.indexOf('<article')).toBeGreaterThan(600_000); // beyond the old 600,000 cut
    const rows: number[] = []; const d = await fetchExternal('https://news.example.com/zorbat', 'Zorbat festival', 'x1', cachedFetch(ctxFor(html, rows)));
    expect(d).not.toBeNull(); expect(d!.text.startsWith('Zorbat festival')).toBe(true); expect(d!.text).toContain('the festival began in the year 1800'); expect(d!.text).not.toContain('trending ticker'); expect(Math.max(...rows)).toBeLessThan(2_000_000);
  });
  it('no <article>/<main>: falls back to the whole page as before', () => { const t = bodyText('<html><body><div><p>' + 'Plain page about the Zorbat festival. '.repeat(80) + '</p></div></body></html>'); expect(t).toContain('Plain page about the Zorbat festival'); });
  it('a short article block (teaser) does not replace the page text', () => { const t = bodyText('<body><article><p>tiny</p></article><div>' + 'Long text about the Zorbat festival here. '.repeat(80) + '</div></body>'); expect(t).toContain('Long text about the Zorbat festival'); });
  it('the longest of several <article> blocks wins', () => { const t = bodyText('<body><article>' + 'teaser. '.repeat(10) + '</article><article>' + 'The main Zorbat story sentence. '.repeat(80) + '</article></body>'); expect(t).toContain('The main Zorbat story'); expect(t).not.toContain('teaser'); });
  it('stored rows are bounded in BYTES, also when escaping and multibyte text inflate the JSON', () => {
    const heavy = ('"\n\u00e9\u4e2d\ud83d\ude00\\').repeat(300_000); const p = packFetched(true, 'https://x.example/a', 'text/html', heavy);
    expect(p.bytes).toBeLessThanOrEqual(MAX_ROW_BYTES); expect(new TextEncoder().encode(p.json).length).toBe(p.bytes); expect(JSON.parse(p.json).body.length).toBe(p.bodyChars); expect(MAX_ROW_BYTES).toBeLessThan(2_000_000);
    const plain = packFetched(true, 'u', 'text/html', 'a'.repeat(5_000_000)); expect(plain.bodyChars).toBe(MAX_FETCH_CHARS); expect(plain.bytes).toBeLessThan(MAX_ROW_BYTES);
  });
  it('a page of heavy escapes goes through the bridge and the written row stays under the D1 string limit', async () => {
    const rows: number[] = []; const html = '<html><body><article>' + '<p>"é中" Zorbat festival \\ line</p>\n'.repeat(60000) + '</article></body></html>'; await cachedFetch(ctxFor(html, rows))('https://news.example.com/zorbat');
    expect(rows.length).toBe(1); expect(rows[0]).toBeLessThanOrEqual(MAX_ROW_BYTES);
  });
  it('a <main> wrapping a qualifying <article> does not hide it; qualifying article beats main beats page', () => {
    const art = 'The Zorbat article sentence. '.repeat(200); const nav = 'Site menu chrome. '.repeat(120);
    const t = bodyText(`<body><main><nav>${nav}</nav><article>${art}</article></main></body>`); expect(t).toContain('Zorbat article sentence'); expect(t).not.toContain('Site menu chrome');
    const t2 = bodyText(`<body><div>Page chrome. </div><main>${'Only main text here. '.repeat(200)}</main></body>`); expect(t2).toContain('Only main text here'); expect(t2).not.toContain('Page chrome');
  });
});
