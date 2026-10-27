# Personalized narrative generation: design (not built yet)

Goal: a longer story on a topic the user likes, written fresh, where every factual sentence is tied to source text and checked.

Pipeline for one story (all in the Worker, Workers AI free allowance only, same guards as ai.ts):
1. Pick a topic from the user's interests; load its Wikipedia page text (bridge.ts loadPageCached). Split into numbered source sentences S1..Sn.
2. Generate: the model writes 5 short paragraphs as JSON sentences `{text, cites:[S ids]}`, using only the numbered sentences.
3. Mechanical checks per sentence: cited ids exist; every number, year and capitalised name in the sentence appears in a cited source sentence.
4. Entailment check per sentence, as a SEPARATE model call: "SOURCE: ... CLAIM: ... Does the source fully support the claim? supported / partly / not supported". Only "supported" passes. Quote existence is not enough: a claim can cite a real sentence and still say something it does not say.
5. Any failing sentence is dropped or the paragraph regenerated (max 2 tries). If the story drops below 4 paragraphs, fall back to a curated story. Nothing unchecked is shown.
6. Label: "Written by AI from one Wikipedia page, each sentence machine-checked against it". Never "verified". Spot-check a sample by hand before first use, record the revision id and date.
Budget estimate (70B rates in aibudget.ts): about 120 neurons to generate plus about 20 judge calls of about 10 neurons = roughly 300-400 per story, so roughly 20 new stories a day inside the 8,000 cap. Stories are cached per topic and revision so many users share them.
Open: the judge model must be benchmarked on known-supported and known-unsupported pairs first (build 30 pairs from the 6 hand-checked stories plus deliberate corruptions). If neither free model passes, generation stays off.

## Judge benchmark, 2026-10-27 (live Workers AI, free allowance)
30 hand-made claim/source pairs from the 6 checked stories: 16 supported paraphrases, 14 corrupted (wrong numbers, wrong entities, added claims, "fully understood" for a not-understood fact). scripts/judge-pairs.json, scripts/judge-bench.mjs.
- llama-3.1-8b: passed 14/16 supported, wrongly passed 0/14 corrupted. About 57 neurons reserved for 30 calls (about 2 each, an estimate from the published rates, not provider-measured).
- llama-3.3-70b: passed 15/16 supported, wrongly passed 0/14 corrupted. About 221 neurons reserved for 30 calls (about 7 each). Slower (21s vs 9s for 30).
Caveats: small, hand-made, corruptions are fairly blunt; subtle paraphrase drift and multi-sentence claims are untested; sources were short (3-5 sentences), real page sections are longer. Not yet evidence that a judge is safe for unattended publishing. Next: add harder pairs (subtle drift, partial support) and run again before any generated story is shown.

## Harder judge benchmark (24 subtle pairs: swapped numbers/roles/dates, overreach), 2026-10-27
- llama-3.1-8b: wrongly passed 4/13 corrupted (e.g. "Venus orbits the Sun in 243 days", "the Prime Minister withdrew the soldiers", "2,500 rounds in the first day"). NOT usable as the judge.
- llama-3.3-70b: wrongly passed 0/13; passed 10/11 supported (one safe miss). About 174 neurons reserved for 24 calls (~7 each).
Decision: judge = 70B only. Still a small hand-made set, not proof of safety; a hand spot check stays mandatory before showing generated stories. scripts/judge-pairs-hard.json, run with PAIRS_FILE=./judge-pairs-hard.json.

## First live pilot attempt, 2026-10-27 (narrative.ts, 70B generate + 70B judge)
Honey (narrative, medium), Octopus (qa, short), Venus (steps, medium): all three produced 0 accepted paragraphs ("too_few_checked_paragraphs"). A diagnostic on Honey showed every sentence was the literal placeholder word "sentence" from the prompt's JSON example, which the judge correctly rejected. So the pipeline refused to show anything (the safe outcome), but the generator prompt was wrong. Prompt fixed (not yet re-run live): placeholder replaced and "never output placeholder text" added. Next: re-run the 3 pilot topics through a temporary key-guarded endpoint (removed after), then hand-review the output against the page text before enabling anything for users. Neuron use for these 4 pilot runs plus all benchmarks today: about 2,000 reserved of the 8,000 cap.

## Pilot results (2026-10-27, live, Workers AI free allowance)
Whole-story JSON generation failed (unparseable, likely truncation). Switched to one paragraph per call, plain lines "sentence || source numbers", per-paragraph source window, repeat/reuse rejection, mechanical check, 70B judge per sentence, one retry.
Accepted: Honey narrative/medium 3 paragraphs, Venus steps/medium 3 paragraphs, Octopus qa/short refused (only repeats/questions survived). Hand check against the page text: all accepted claims found in the source. Known weaknesses: qualifiers can be dropped ("honey does not spoil" omits "when properly stored"); output is a compressed paraphrase of one page, not a deeper story; Q&A format unreliable. Not wired to users.

## Pilot 2, with conservative qualifier guard (2026-10-27)
Honey, Venus, Moon refused (guard and repeat rules dropped too many paragraphs). Octopus narrative/medium was accepted but hand review found two overclaims that passed the 70B judge: "Octopuses is the only acceptable pluralisation" (source: octopi is "usually considered etymologically incorrect", and octopodes has been used) and "most frequently used term". Conclusion: the free Llama path cannot be trusted to publish unattended, and the token-presence qualifier guard is a weak filter (see adversarial tests). Generation stays unwired; curated hand-compared stories remain the only stories shown.

## Paid trial pilot (2026-10-27, owner-approved up to $2 total, trial only)
Writer claude-haiku-5-5 (thinking off), judge claude-sonnet-5-5 (thinking "between_tools"; the model docs say disabled is unsupported on Sonnet 5.5 and Haiku 5.5 defaults to adaptive thinking that ate the whole output budget until turned off). Model IDs: https://platform.claude.com/docs/en/about-claude/models/all-models. Same pipeline: paragraph per call, source window, mechanical check, per-sentence judge, repeat rejection.
Results, medium length, 6 runs: accepted Honey narrative (3 paragraphs) and Venus narrative (3 paragraphs); refused Honey steps, Venus steps, Octopus narrative, Octopus steps.
Hand review against the fetched page text: every number and name in the two accepted stories was found in the source (1613, 1.6 years, 81.5%, third-smallest, 8,000 years, 70 to 80% / 18% water). Defects: the Honey story has a repeated fact across paragraphs 2 and 3 (same "cold weather, bees eat stored honey" point, paraphrased, which the repeat guard missed) and an abrupt topic jump in paragraph 2; one clause (stingless-bee wax and resin pots) was not re-checked in full. The Sonnet judge flagged the Octopus "only acceptable plural" overclaim as PARTLY that the Llama judge had passed.
Measured: 109 API calls, 42,012 input and 8,974 output tokens (from response usage). Ledger worst-case reservation total $0.154 of the $2 cap. Billing console is the source of truth for exact dollars.
Paid path then disabled: secrets deleted, temp endpoint removed. Not wired to users; the grant is trial only.
