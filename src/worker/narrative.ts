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
export function parseGen(raw: string): GenSentence[][] | null {
  const m = raw.match(/\{[\s\S]*\}/); if (!m) return null;
  try { const o = JSON.parse(m[0]); if (!Array.isArray(o.paragraphs)) return null;
    return o.paragraphs.map((p: any) => (Array.isArray(p) ? p : []).filter((x: any) => typeof x?.t === 'string' && Array.isArray(x?.c)).map((x: any) => ({ t: x.t.trim(), c: x.c.filter((n: any) => Number.isInteger(n)) })));
  } catch { return null; }
}
export type Story = { title: string; url: string; fmt: Fmt; len: Len; paragraphs: string[]; dropped: number; label: string };
export async function generateStory(env: AiEnv, page: Page, fmt: Fmt, len: Len): Promise<{ ok: true; story: Story } | { ok: false; reason: string }> {
  const src = sourceSentences(page); if (src.length < 8) return { ok: false, reason: 'source_too_short' };
  const numbered = src.map((s, i) => `[${i + 1}] ${s}`).join('\n');
  const want = PARAS[len];
  const g = await guardedRun(env, { model: GEN_MODEL, maxTokens: 600, system: `You write ${STYLE[fmt]} about the topic using ONLY the numbered source sentences. Write ${want} short paragraphs, 2-3 sentences each. Every sentence must be a faithful restatement of one or two source sentences, with no added facts, dates, numbers or names. Reply JSON only: {"paragraphs":[[{"t":"<your restated sentence>","c":[3,4]}]]} where each "c" lists the numbers of the source sentences you used. Never output placeholder text.`, prompt: `Topic: ${page.title}\nSources:\n${numbered}` });
  if (!g.ok) return { ok: false, reason: g.reason };
  const paras = parseGen(g.text); if (!paras) return { ok: false, reason: 'unparseable' };
  const kept: string[] = []; let dropped = 0; const dbg: string[] = [];
  for (const p of paras) {
    const okSent: string[] = [];
    for (const s of p) {
      const cited = s.c.filter((n) => n >= 1 && n <= src.length).map((n) => src[n - 1]);
      if (!cited.length || !mechanicalOk(s.t, cited)) { dropped++; dbg.push('MECH ' + s.t.slice(0, 80) + ' | cites ' + s.c.join(',')); continue; }
      const v = await judge(env, GEN_MODEL, cited.join(' '), s.t);
      if (v === 'SUPPORTED') okSent.push(s.t); else { dropped++; dbg.push(v + ' ' + s.t.slice(0, 80)); }
    }
    if (okSent.length === p.length && p.length > 0) kept.push(okSent.join(' ')); else dropped += 0; // a paragraph with any failed sentence is dropped whole
  }
  if (kept.length < Math.max(2, want - 1)) return { ok: false, reason: 'too_few_checked_paragraphs' };
  return { ok: true, story: { title: page.title, url: page.url, fmt, len, paragraphs: kept, dropped, label: 'Written by AI from one Wikipedia page. Each sentence was machine-checked against it; that is not independent verification.' } };
}
