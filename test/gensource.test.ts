import { describe, it, expect } from 'vitest';
import { usableRef, registrable, htmlToText, mentionsTopic, acquireSources } from '../src/gen/source';
import { TOPICS, topicAllowed } from '../src/gen/topics';
import { TOPIC_TAGS } from '../src/content/seed';
describe('reference filtering', () => {
  it('only public https hosts', () => { for (const u of ['http://a.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://a.com:8443/x', 'https://u:p@a.com/x', 'https://en.wikipedia.org/x', 'https://web.archive.org/x', 'https://doi.org/10.1/x', 'https://someone.blogspot.com/x', 'https://x.wordpress.com/a', 'https://a.com/f.pdf', 'ftp://a.com']) expect(usableRef(u), u).toBeNull(); expect(usableRef('https://www.theguardian.com/a')).toContain('theguardian'); });
  it('registrable host groups', () => { expect(registrable('www.theguardian.com')).toBe('theguardian.com'); expect(registrable('news.bbc.co.uk')).toBe('bbc.co.uk'); expect(registrable('www.isro.gov.in')).toBe('isro.gov.in'); });
  it('html to text strips scripts and tags', () => { const t = htmlToText('<html><script>evil()</script><p>Hello &amp; welcome</p><style>x{}</style><div>Second</div></html>'); expect(t).toContain('Hello & welcome'); expect(t).not.toContain('evil'); expect(t).toContain('Second'); });
  it('topic mention check', () => { expect(mentionsTopic('The dabbawala system', 'Dabbawala')).toBe(true); expect(mentionsTopic('Cooking tips', 'Dabbawala')).toBe(false); });
});
describe('acquireSources with a fake network', () => {
  const html = (s: string) => `<html><body><p>${s.repeat(90)}</p></body></html>`;
  const f = (async (url: string) => {
    if (url.includes('prop=extracts')) return { ok: true, json: async () => ({ query: { pages: [{ title: 'Chai', extract: 'Chai is tea. '.repeat(50), revisions: [{ revid: 7 }] }] } }) };
    if (url.includes('prop=extlinks')) return { ok: true, json: async () => ({ query: { pages: [{ extlinks: [{ url: 'https://news.example.com/a' }, { url: 'https://news.example.com/b' }, { url: 'https://other.example.org/c' }, { url: 'http://insecure.example/d' }, { url: 'https://thin.example.net/e' }] }] } }) };
    const body = url.includes('thin') ? 'tiny' : url.includes('other') ? html('Chai history and chai trade. ') : html('Chai is tea served with milk. ');
    return { ok: true, url, headers: { get: () => 'text/html' }, text: async () => body };
  }) as any;
  it('returns wikipedia plus independent hosts only, one per host', async () => { const d = await acquireSources('Chai', f); expect(d!.map((x) => x.groupId)).toEqual(['wikipedia', 'example.com', 'example.org']); expect(d![0].revisionId).toBe(7); });
  it('returns null when the article is missing', async () => { expect(await acquireSources('Nope', (async () => ({ ok: false })) as any)).toBeNull(); });
  it('caps external fetch attempts', async () => { let n = 0; const g = (async (u: string, i: any) => { if (!u.includes('en.wikipedia.org')) n++; return f(u, i); }) as any; await acquireSources('Chai', g, 1); expect(n).toBe(1); });
});
describe('topic pool', () => { it('tags are valid and titles allowed', () => { for (const t of TOPICS) { expect(t.tags.every((g) => TOPIC_TAGS.includes(g)), t.title).toBe(true); expect(topicAllowed(t), t.title).toBe(true); } expect(new Set(TOPICS.map((t) => t.title)).size).toBe(TOPICS.length); }); });
