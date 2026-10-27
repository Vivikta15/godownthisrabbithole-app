import { describe, it, expect } from 'vitest';
import { checkDraft, type Fetcher, type Judge } from '../src/content/pipeline';
const f: Fetcher = { fetch: async (u) => u.includes('good') ? { url: u, fetchedAt: 0, text: 'Emus were hunted in 1932 in Western Australia.' } : null };
const j: Judge = { supports: async (c) => ({ supported: true, quote: c.includes('fake') ? 'invented quote' : 'hunted in 1932' }) };
describe('checkDraft', () => {
  it('accepts only when quote is literally in fetched text', async () => {
    const r = await checkDraft({ title: 't', body: '', claims: [{ text: 'emus 1932', sourceUrls: ['https://good'] }] }, f, j);
    expect(r.status).toBe('checked_by_automated_filter');
  });
  it('rejects a judge quote not present in the source', async () => {
    expect((await checkDraft({ title: 't', body: '', claims: [{ text: 'fake claim', sourceUrls: ['https://good'] }] }, f, j)).status).toBe('rejected');
  });
  it('rejects unsourced or unfetchable claims and empty drafts', async () => {
    expect((await checkDraft({ title: 't', body: '', claims: [{ text: 'x', sourceUrls: [] }] }, f, j)).status).toBe('rejected');
    expect((await checkDraft({ title: 't', body: '', claims: [{ text: 'x', sourceUrls: ['https://bad'] }] }, f, j)).status).toBe('rejected');
    expect((await checkDraft({ title: 't', body: '', claims: [] }, f, j)).status).toBe('rejected');
  });
});
