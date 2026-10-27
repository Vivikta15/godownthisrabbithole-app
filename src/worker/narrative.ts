// Generated narrative pipeline (NOT enabled for users; needs hand review of a pilot first). Free Workers AI only, via guardedRun.
// Every sentence must cite numbered source sentences, pass mechanical checks, and pass a separate 70B entailment judge. These are fallible filters, not proof.
import { guardedRun, type AiEnv } from './ai';
import { judge } from './judge';
import { sentences, type Page } from './bridge';
export const GEN_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'; // the 8B judge failed subtle swaps in the benchmark
export type Fmt = 'narrative' | 'qa' | 'steps'; export type Len = 'short' | 'medium' | 'long';
export type GenSentence = { t: string; c: number[] };
export const cacheKey = (title: string, revision: string, fmt: Fmt, len: Len) => `n1:${title.toLowerCase()}:${revision}:${fmt}:${len}`;
const PARAS: Record<Len, number> = { short: 2, medium: 4, long: 6 };
const STYLE: Record<Fmt, string> = { narrative: 'a flowing story told to a curious friend', qa: 'a sequence of questions, each followed by its answer (put the question as its own short sentence)', steps: 'a step by step walk-through where each paragraph is one step' };

export function sourceSentences(page: Page, max = 24): string[] { return sentences(page.text).slice(0, max); }
const nums = (s: string) => s.match(/\d[\d,.]*/g) ?? [];
const names = (s: string) => (s.match(/(?<![.!?]\s)(?<!^)\b[A-Z][a-z]{2,}\b/g) ?? []);
// Numbers and mid-sentence capitalised names in a claim must appear in the cited source sentences.
export function mechanicalOk(claim: string, cited: string[]): boolean {
  const src = cited.join(' ').toLowerCase();
  return nums(claim).every((n) => src.includes(n.replace(/[.,]$/, '').toLowerCase())) && names(claim).every((n) => src.includes(n.toLowerCase()));
}
const HEDGE = /\b(may|might|usually|often|about|approximately|frequently|typically|generally|unless|if|when properly|mostly|most|some|can|could|likely|roughly)\b/i;
// Conservative qualifier guard: if the cited source sentences hedge, the claim must keep some hedge too. Fallible; drops more than it needs to.
export function qualifiersOk(claim: string, cited: string[]): boolean {
  return !HEDGE.test(cited.join(' ')) || HEDGE.test(claim);
}
export function parseGen(raw: string): GenSentence[][] | null {
  const m = raw.match(/\{[\s\S]*\}/); if (!m) return null;
  try { const o = JSON.parse(m[0]); if (!Array.isArray(o.paragraphs)) return null;
    return o.paragraphs.map((p: any) => (Array.isArray(p) ? p : []).filter((x: any) => typeof x?.t === 'string' && Array.isArray(x?.c)).map((x: any) => ({ t: x.t.trim(), c: x.c.filter((n: any) => Number.isInteger(n)) })));
  } catch { return null; }
}
export type Story = { title: string; url: string; fmt: Fmt; len: Len; paragraphs: string[]; dropped: number; label: string };
// One paragraph per call, plain lines "sentence || 3,4" (robust to truncation). Each paragraph gets its own window of the source.
export function parseLines(raw: string): GenSentence[] {
  const out: GenSentence[] = [];
  for (const line of raw.split('\n')) { const m = line.match(/^\s*(?:[-*\d.]+\s+)?(.+?)\s*\|\|\s*\[?([\d,\s]+)\]?\s*$/); if (!m) continue;
    const c = m[2].split(',').map((x) => parseInt(x, 10)).filter((n) => Number.isInteger(n)); if (c.length && m[1].length > 15) out.push({ t: m[1].trim(), c }); }
  return out;
}
export const LABEL = 'Written by AI from one Wikipedia page. Each sentence was machine-checked against it; that is not independent verification.';
export async function generateStory(env: AiEnv, page: Page, fmt: Fmt, len: Len, debug?: string[]): Promise<{ ok: true; story: Story } | { ok: false; reason: string }> {
  const src = sourceSentences(page, 30); if (src.length < 8) return { ok: false, reason: 'source_too_short' };
  const want = PARAS[len]; const win = Math.ceil(src.length / want);
  const kept: string[] = []; let dropped = 0; const used = new Set<number>(); const seen = new Set<string>();
  for (let k = 0; k < want; k++) {
    const lo = k * win, hi = Math.min(src.length, lo + win + 2); if (lo >= src.length) break;
    const numbered = src.slice(lo, hi).map((x, i) => `[${lo + i + 1}] ${x}`).join('\n');
    let accepted: string | null = null;
    for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
      const g = await guardedRun(env, { model: GEN_MODEL, maxTokens: 350, system: `You write ${STYLE[fmt]} about "${page.title}" using ONLY the numbered source sentences. Write ONE paragraph of 2-3 sentences${k === 0 ? ', opening with a hook' : ', continuing the piece'}. Each sentence must faithfully restate one or two source sentences: no added facts, dates, numbers or names. Keep every sentence under 30 words and end it with a period. Do not repeat a sentence. ${fmt === 'qa' ? 'Make the first sentence a question and the rest the answer.' : ''} Output exactly one line per sentence in this format:\nyour restated sentence || 3,4\nwhere the numbers after || are the source sentence numbers used. No other text.`, prompt: numbered });
      if (!g.ok) return { ok: false, reason: g.reason };
      const p = parseLines(g.text); if (!p.length) { dropped++; debug?.push('UNPARSED ' + g.text.slice(0, 200)); continue; }
      const okS: string[] = []; let bad = false;
      for (const x of p) {
        const key = x.t.toLowerCase().replace(/[^a-z]/g, ''); if (seen.has(key) || x.c.every((n) => used.has(n))) { bad = true; debug?.push('REPEAT ' + x.t.slice(0, 60)); break; }
        const cited = x.c.filter((n) => n >= lo + 1 && n <= hi).map((n) => src[n - 1]);
        if (!cited.length || !mechanicalOk(x.t, cited) || !qualifiersOk(x.t, cited)) { bad = true; debug?.push('MECH ' + x.t.slice(0, 90)); break; }
        const v = await judge(env, GEN_MODEL, cited.join(' '), x.t);
        if (v !== 'SUPPORTED') { bad = true; debug?.push(v + ' ' + x.t.slice(0, 90)); break; }
        okS.push(x.t.replace(/[.\s]+$/, '') + '.'); seen.add(key); x.c.forEach((n) => used.add(n));
      }
      if (bad) dropped++; else accepted = okS.join(' ');
    }
    if (accepted) kept.push(accepted);
  }
  if (kept.length < Math.max(2, want - 1)) return { ok: false, reason: 'too_few_checked_paragraphs' };
  return { ok: true, story: { title: page.title, url: page.url, fmt, len, paragraphs: kept, dropped, label: LABEL } };
}
