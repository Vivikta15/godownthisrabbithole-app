// Per-sentence entailment judge for generated stories: "does the source fully support the claim?" Benchmarked before any use.
import { guardedRun, type AiEnv } from './ai';
export const JUDGE_SYSTEM = 'You check one claim against one source text. Use ONLY the source. Answer with exactly one word: SUPPORTED if every fact in the claim is stated by the source, PARTLY if only some are, NOT if the claim adds, changes or contradicts facts, or the source does not say it.';
export async function judge(env: AiEnv, model: string, source: string, claim: string): Promise<'SUPPORTED' | 'PARTLY' | 'NOT' | 'ERROR'> {
  const r = await guardedRun(env, { model, system: JUDGE_SYSTEM, prompt: `SOURCE:\n"""${source}"""\n\nCLAIM: ${claim}\n\nOne word:`, maxTokens: 6 });
  if (!r.ok) return 'ERROR';
  const t = r.text.trim().toUpperCase();
  return t.startsWith('SUPPORTED') ? 'SUPPORTED' : t.startsWith('PARTLY') ? 'PARTLY' : t.startsWith('NOT') ? 'NOT' : 'ERROR';
}
