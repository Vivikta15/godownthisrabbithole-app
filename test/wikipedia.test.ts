import { describe, it, expect } from 'vitest';
import { titleFromUrl, parseExtract, wikipediaFetcher, apiUrl } from '../src/content/wikipedia';
import { checkDraft } from '../src/content/pipeline';
const page = { query: { pages: [{ pageid: 1, title: 'Emu War', extract: 'The emus split into small, alert and highly mobile groups making the operation uneconomic.', revisions: [{ revid: 42, timestamp: 't' }] }] } };
describe('wikipedia source', () => {
  it('accepts only en.wikipedia /wiki/ article URLs', () => {
    expect(titleFromUrl('https://en.wikipedia.org/wiki/Emu_War')).toBe('Emu_War');
    for (const u of ['http://en.wikipedia.org/wiki/X', 'https://evil.example/wiki/X', 'https://en.wikipedia.org.evil.example/wiki/X', 'https://en.wikipedia.org/wiki/Special:Random', 'https://en.wikipedia.org/w/index.php?title=X', 'not a url']) expect(titleFromUrl(u)).toBeNull();
  });
  it('encodes the title in the API url', () => { expect(apiUrl('A&B')).toContain('titles=A%26B'); });
  it('parses extract and revision; rejects missing pages', () => {
    expect(parseExtract(page, 'u')!.revisionId).toBe(42);
    expect(parseExtract({ query: { pages: [{ title: 'X', missing: true }] } }, 'u')).toBeNull();
    expect(parseExtract({}, 'u')).toBeNull();
  });
  it('plugs into the checker (stub fetch, stub judge); judge quote must be verbatim', async () => {
    const f = wikipediaFetcher((async () => new Response(JSON.stringify(page))) as any);
    const d = { title: 't', body: '', claims: [{ text: 'emus split into groups', sourceUrls: ['https://en.wikipedia.org/wiki/Emu_War'] }] };
    expect((await checkDraft(d, f, { supports: async () => ({ supported: true, quote: 'split into small, alert and highly mobile groups' }) })).status).toBe('checked_by_automated_filter');
    expect((await checkDraft(d, f, { supports: async () => ({ supported: true, quote: 'made up words' }) })).status).toBe('rejected');
  });
});
