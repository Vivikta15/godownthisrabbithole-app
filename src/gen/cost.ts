// Cost worksheet. Pure arithmetic over stated assumptions. Provisional rates. Not a measurement, not a quote, and nothing here calls any API.
// UNITS: tokens are tokens; rates are USD per million tokens (MTok); searches are counts; money is USD (micro-USD in the cap code).
// STRUCTURE: an ATTEMPT is one try to produce one candidate story. Within an attempt, each stage has input tokens, output tokens,
// a call count, and a within-attempt retry factor (re-calls of the same stage after a failed mechanical check). ACCEPTANCE is the share of
// attempts that end in a published story. It is applied exactly once: costPerAccepted = costPerAttempt / acceptance.
export type Rates = { inPerM: number; outPerM: number };
export type Stage = { name: string; model: 'writer' | 'judge'; calls: number; inTokensPerCall: number; outTokensPerCall: number; thinkingOutPerCall: number; stageRetryFactor: number };
export type Search = { count: number; usdPerThousand: number };
export type Worksheet = { writer: Rates; judge: Rates; stages: Stage[]; search: Search; acceptance: number; batchDiscount: number /* 1 = none, 0.5 = batch */ };

export const PROVISIONAL = { writer: { inPerM: 0.1, outPerM: 0.5 } /* Haiku 5.5, prompts <=100k */, judge: { inPerM: 2, outPerM: 10 } /* Sonnet 5.5 */ };
// Illustrative stage plan for ONE 7-paragraph multi-source story. Every number is an assumption to replace with measured usage after an approved pilot.
export const DEFAULT_STAGES: Stage[] = [
  { name: 'extract claims (3 sources)', model: 'writer', calls: 3, inTokensPerCall: 6000, outTokensPerCall: 900, thinkingOutPerCall: 0, stageRetryFactor: 1.1 },
  { name: 'outline', model: 'writer', calls: 1, inTokensPerCall: 3000, outTokensPerCall: 500, thinkingOutPerCall: 0, stageRetryFactor: 1.2 },
  { name: 'write 7 paragraphs', model: 'writer', calls: 7, inTokensPerCall: 3500, outTokensPerCall: 350, thinkingOutPerCall: 0, stageRetryFactor: 1.5 },
  { name: 'judge ~28 sentences', model: 'judge', calls: 28, inTokensPerCall: 900, outTokensPerCall: 60, thinkingOutPerCall: 0, stageRetryFactor: 1.2 },
  { name: 'adversarial review', model: 'judge', calls: 1, inTokensPerCall: 4500, outTokensPerCall: 400, thinkingOutPerCall: 0, stageRetryFactor: 1 },
];
export const DEFAULT: Worksheet = { ...PROVISIONAL, stages: DEFAULT_STAGES, search: { count: 0, usdPerThousand: 10 }, acceptance: 1 / 3, batchDiscount: 1 };

export type Row = { name: string; model: string; inTokens: number; outTokens: number; usd: number };
export function worksheet(w: Worksheet): { rows: Row[]; attemptUsd: number; searchUsd: number; perAcceptedUsd: number; acceptance: number } {
  const rows = w.stages.map((s) => {
    const calls = s.calls * s.stageRetryFactor; const r = s.model === 'writer' ? w.writer : w.judge;
    const inTokens = calls * s.inTokensPerCall, outTokens = calls * (s.outTokensPerCall + s.thinkingOutPerCall); // thinking bills as output
    return { name: s.name, model: s.model, inTokens, outTokens, usd: ((inTokens * r.inPerM + outTokens * r.outPerM) / 1e6) * w.batchDiscount };
  });
  const searchUsd = (w.search.count * w.search.usdPerThousand) / 1000; // not discounted by batch
  const attemptUsd = rows.reduce((a, r) => a + r.usd, 0) + searchUsd;
  return { rows, attemptUsd, searchUsd, perAcceptedUsd: w.acceptance > 0 ? attemptUsd / w.acceptance : Infinity, acceptance: w.acceptance };
}
export function format(w: Worksheet): string {
  const r = worksheet(w); const f = (n: number) => '$' + n.toFixed(4);
  return [`stage | model | input tok | output tok (incl thinking) | USD`, ...r.rows.map((x) => `${x.name} | ${x.model} | ${Math.round(x.inTokens)} | ${Math.round(x.outTokens)} | ${f(x.usd)}`),
    `search (${w.search.count} at $${w.search.usdPerThousand}/1000) | | | | ${f(r.searchUsd)}`, `COST PER ATTEMPT | | | | ${f(r.attemptUsd)}`,
    `acceptance (applied once) | ${(r.acceptance * 100).toFixed(0)}%`, `COST PER ACCEPTED STORY | ${f(r.perAcceptedUsd)}`].join('\n');
}
