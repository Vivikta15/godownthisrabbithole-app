// Paid judge benchmark, counted against the generator's $3.50/month ledger (remote D1 gen_spend_log). Usage: node scripts/judge-bench-paid.mjs <model> [pairs.json]
// Env: KEYFILE (Anthropic key file), CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID. Reserves the WORST CASE for the whole run first (one row), runs calls one at a time, then settles to provider-reported usage.
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const model = process.argv[2]; const file = process.argv[3] || 'scripts/judge-pairs.json';
const RATES = { 'claude-haiku-5-5': [0.1, 0.5], 'claude-sonnet-5': [2, 10] }; if (!RATES[model]) throw new Error('model not allowlisted');
const key = fs.readFileSync(process.env.KEYFILE, 'utf8').trim();
const { sources, pairs } = JSON.parse(fs.readFileSync(file));
const SYSTEM = fs.readFileSync('src/worker/judge.ts', 'utf8').match(/JUDGE_SYSTEM = '((?:[^'\\]|\\.)*)'/)[1].replace(/\\'/g, "'");
const MAXOUT = 8; const bodyFor = (p) => JSON.stringify({ model, max_tokens: MAXOUT, system: SYSTEM, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: `SOURCE:\n"""${sources[p.source]}"""\n\nCLAIM: ${p.claim}\n\nOne word:` }] });
const worst = pairs.reduce((a, p) => a + Math.ceil(Buffer.byteLength(bodyFor(p)) * RATES[model][0] + MAXOUT * RATES[model][1]), 0);
const d1 = (sql) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'rabbithole-app', '--remote', '--json', '--command', sql], { encoding: 'utf8' });
const now = Date.now(), id = `bench-${model}-${now}`, dayStart = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()), monthStart = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1);
const CAP = 3300000, DAYCAP = Math.floor(2 * CAP / 30);
const sql = `INSERT INTO gen_spend_log (id, ts, micro, state, note) SELECT '${id}', ${now}, ${worst}, 'reserved', 'judge benchmark ${model}' WHERE (SELECT COALESCE(SUM(micro),0) FROM gen_spend_log WHERE ts >= ${monthStart}) + ${worst} <= ${CAP} AND (SELECT COALESCE(SUM(micro),0) FROM gen_spend_log WHERE ts >= ${now - 30 * 86400000}) + ${worst} <= ${CAP} AND (SELECT COALESCE(SUM(micro),0) FROM gen_spend_log WHERE ts >= ${dayStart}) + ${worst} <= ${DAYCAP}`;
const res = JSON.parse(d1(sql)); if (res[0].meta.changes !== 1) { console.log(JSON.stringify({ refused: 'over cap or day cap', worstMicro: worst })); process.exit(2); }
console.log('reserved worst case micro-USD', worst, 'for', pairs.length, 'calls');
let inTok = 0, outTok = 0, errs = 0, tp = 0, fp = 0, fn = 0, tn = 0; const wrong = []; let failed = false;
for (const p of pairs) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: bodyFor(p) });
    if (!r.ok) { errs++; failed = true; console.log('http', r.status); break; }
    const j = await r.json(); inTok += j.usage.input_tokens; outTok += j.usage.output_tokens;
    const v = (j.content?.[0]?.text || '').trim().toUpperCase(); const pass = v.startsWith('SUPPORTED');
    if (p.label === 'S') pass ? tp++ : fn++; else pass ? (fp++, wrong.push(`FALSE ACCEPT: ${p.claim}`)) : tn++;
  } catch (e) { errs++; failed = true; console.log('error', String(e).slice(0, 80)); break; }
}
const actual = Math.ceil(inTok * RATES[model][0] + outTok * RATES[model][1]);
if (failed) d1(`UPDATE gen_spend_log SET state='failed_kept' WHERE id='${id}'`); else d1(`UPDATE gen_spend_log SET micro=${Math.max(1, Math.min(actual, worst))}, state='settled' WHERE id='${id}'`);
console.log(JSON.stringify({ model, file, supportedPassed: `${tp}/${tp + fn}`, corruptedWronglyPassed: `${fp}/${fp + tn}`, errors: errs, inTokens: inTok, outTokens: outTok, actualMicro: actual, reservedWorstMicro: worst, ledger: failed ? 'kept full reservation (failure)' : 'settled to usage' }));
console.log(wrong.join('\n'));
