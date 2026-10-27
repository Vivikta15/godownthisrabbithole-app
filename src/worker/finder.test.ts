import { describe, it, expect } from 'vitest';
import { cleanWord, parseAnswer, verify, findConnection, sharedWords } from './finder';
const A = { title: 'Moon', url: 'u1', text: 'The Moon is the only natural satellite of Earth. It orbits Earth in an elliptical path.' };
const B = { title: 'Tide', url: 'u2', text: 'Tides are the rise and fall of sea levels caused by gravity of the Moon and the Sun, and the rotation of Earth.' };
const wiki = (pages: Record<string, any>) => (async (u: string) => { const w = decodeURIComponent(u.split('gsrsearch=')[1]); const p = pages[w]; return { ok: true, json: async () => ({ query: p ? { pages: { 1: p } } : undefined }) } as any; }) as any;
const pages = { moon: { title: 'Moon', extract: A.text }, tides: { title: 'Tide', extract: B.text } };
const env = (out: string, extra: any = {}) => { let calls = 0; const db = { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }), first: async () => ({}) }) }) }; return { e: { DB: db, AI_ENABLED: 'true', AI_PLAN_CONFIRMED: 'free', AI: { run: async () => { calls++; return { response: out }; } }, ...extra } as any, calls: () => calls }; };
describe('finder', () => {
  it('cleans words', () => { expect(cleanWord(' moon ')).toBe('moon'); expect(cleanWord('a'.repeat(50))).toBeNull(); expect(cleanWord('x<script>')).toBeNull(); expect(cleanWord('')).toBeNull(); });
  it('accepts only verbatim quotes', () => {
    const good = JSON.stringify({ link: 'The Moon\'s gravity helps cause the tides on Earth.', quoteA: 'The Moon is the only natural satellite of Earth.', quoteB: 'Tides are the rise and fall of sea levels caused by gravity of the Moon and the Sun, and the rotation of Earth.' });
    expect(verify(parseAnswer(good), A, B)?.quotes.length).toBe(2);
    const fake = JSON.stringify({ link: 'The Moon is made of cheese, say the tides.', quoteA: 'The Moon is made entirely of cheese and tides.', quoteB: 'Tides are the rise and fall of sea levels caused by gravity of the Moon and the Sun, and the rotation of Earth.' });
    expect(verify(parseAnswer(fake), A, B)).toBeNull();
    expect(verify(parseAnswer('{"link":null}'), A, B)).toBeNull(); expect(parseAnswer('nonsense')).toBeNull();
  });
  it('rejects real quotes with nothing in common (fabricated link)', () => {
    const a = { title: 'Venus', url: 'u', text: 'From Earth, Venus is visible as a star-like point of light, appearing brighter than any other natural point of light in the sky.' };
    const b = { title: 'Oxford', url: 'u', text: "Oxford's industries include motor manufacturing, education, publishing, science and information technology." };
    const out = JSON.stringify({ link: 'The University of Oxford has a planetarium that shows Venus.', quoteA: a.text, quoteB: b.text });
    expect(verify(parseAnswer(out), a, b)).toBeNull(); expect(sharedWords('tidal forces drive the tides', 'Tides are the rise and fall of sea')).toEqual(['tides']);
  });
  it('end to end with fakes: link, then honest no_link on a fabricated quote', async () => {
    const good = JSON.stringify({ link: 'The Moon\'s gravity helps cause the tides on Earth.', quoteA: 'The Moon is the only natural satellite of Earth.', quoteB: 'Tides are the rise and fall of sea levels caused by gravity of the Moon and the Sun, and the rotation of Earth.' });
    const { e } = env(good); const r = await findConnection(e, 'moon', 'tides', wiki(pages)); expect(r.ok).toBe(true);
    const bad = env('{"link":"They are both round and shiny and famous.","quoteA":"The Moon is bright and shiny in the sky tonight.","quoteB":"Tides are made of moonlight and joy together."}');
    const r2 = await findConnection(bad.e, 'moon', 'tides', wiki(pages)); expect(r2.ok).toBe(false); expect((r2 as any).reason).toBe('no_link');
  });
  it('does not call AI when a page is missing or AI is off', async () => {
    const x = env('{}'); const r = await findConnection(x.e, 'moon', 'zzzz', wiki(pages)); expect((r as any).reason).toBe('no_page'); expect(x.calls()).toBe(0);
    const off = env('{}', { AI_ENABLED: 'false' }); const r3 = await findConnection(off.e, 'moon', 'tides', wiki(pages)); expect((r3 as any).reason).toBe('ai_unavailable'); expect(off.calls()).toBe(0);
  });
});
