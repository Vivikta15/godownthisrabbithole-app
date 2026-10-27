// NOTE: needs a temporary /api/_bench endpoint (guarded by a random Worker secret) that calls judge(); it was removed after the 2026-10-27 run. Re-add it from git history (commit "Judge bench") to rerun.
// Runs the judge on scripts/judge-pairs.json via the temporary /api/_bench endpoint. Prints accuracy and the reserved-neuron delta.
import fs from 'node:fs'; const { sources, pairs } = JSON.parse(fs.readFileSync(new URL('./judge-pairs.json', import.meta.url)));
const call = async (model, p) => { const r = await fetch(process.env.BASE + '/api/_bench', { method: 'POST', headers: { 'content-type': 'application/json', 'x-bench-key': fs.readFileSync(process.env.KEYFILE, 'utf8').trim() }, body: JSON.stringify({ model, source: sources[p.source], claim: p.claim }) }); return r.json(); };
for (const model of process.argv.slice(2)) {
  let first = null, last = null, tp = 0, fp = 0, fn = 0, tn = 0, err = 0; const t0 = Date.now(); const wrong = [];
  for (const p of pairs) { const r = await call(model, p); if (first === null) first = r.reservedBefore; last = r.reservedBefore; const pass = r.v === 'SUPPORTED'; if (r.v === 'ERROR') err++; if (p.label === 'S') pass ? tp++ : fn++; else pass ? fp++ : tn++; if ((p.label === 'N') === pass) wrong.push(`${p.label}->${r.v}: ${p.claim.slice(0, 60)}`); }
  console.log(JSON.stringify({ model: model.split('/').pop(), supportedPassed: `${tp}/${tp + fn}`, corruptedWronglyPassed: `${fp}/${fp + tn}`, errors: err, ms: Date.now() - t0, reservedDeltaApprox: last - first })); console.log(wrong.join('\n'));
}
