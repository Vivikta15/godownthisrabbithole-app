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
