// Prints the cost worksheet. Run: node scripts/cost-worksheet.mjs [acceptance] [thinkingTokensPerCall] [searches]. Provisional rates; see src/gen/cost.ts
import { DEFAULT, DEFAULT_STAGES, format } from '../src/gen/cost.ts';
const [acc, think, search] = [Number(process.argv[2] ?? DEFAULT.acceptance), Number(process.argv[3] ?? 0), Number(process.argv[4] ?? 0)];
console.log(format({ ...DEFAULT, acceptance: acc, stages: DEFAULT_STAGES.map((s) => ({ ...s, thinkingOutPerCall: think })), search: { ...DEFAULT.search, count: search } }));
