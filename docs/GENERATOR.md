# Lasting story generator: preparation (2026-10-28, nothing wired, nothing paid)

Status: design plus pure, tested modules in src/gen (ledger.ts, policy.ts, test/gen.test.ts). No route, cron, secret or paid call uses them.

## Separation
- Generation fills a pool of candidate stories. Access policy (src/gen/policy.ts) decides who may open how many. Today's product is { daily, all } and stays that way until the owner chooses otherwise. On-demand and N per day are config values.

## Claim ledger (src/gen/ledger.ts)
- Each source has a license and a groupId. Mirrors and derivatives share a group, so they never count as independent.
- Claims are keyed facts with the source quote. classifyClaims gives central (two or more independent groups agree), disputed (independent groups differ), single (one group).
- Writer rules: central may be plain, single must be attributed, disputed may only be shown as a disagreement. Fixture: the dabbawala origin details (1890 agrees, founding crew size disputed) from the real corroboration pass.
- Agreement is evidence, not proof or human verification. A ledger also does not settle reuse rights: Wikipedia is CC BY-SA (attribution and share-alike on derived text; https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content). licenceFlags only raises flags for a human. Not legal advice.

## Rejections and pool
- Every candidate ends accepted or with one named reason. Acceptance rate drives cost.
- Pool states: healthy, low, empty, paused_cap. Empty and paused are shown to the owner, never hidden by a silent fallback.

## Spend
- Monthly cap in integer micro-dollars, reserved before each call, never refunded (same idea as src/worker/anthropic.ts, which has a lifetime trial cap and is OFF).
- Rates in the forecast are provisional: Anthropic's pricing and all-models pages show the 5.5 lineup, its overview page shows an older one. Read exact IDs and prices from the owner's own account before activation.

## Cost: one worksheet (src/gen/cost.ts, run `node scripts/cost-worksheet.mjs [acceptance] [thinkingTokensPerCall] [searches]`)
This replaces every earlier figure (the 17:16, 17:17 and 17:19 numbers used different, cruder assumptions).
- Units: tokens, USD per million tokens, search counts. An ATTEMPT is one try at one candidate. Each stage lists calls, input and output tokens per call, billed thinking (as output), and a within-stage retry factor. Acceptance is applied exactly once: cost per accepted = cost per attempt / acceptance.
- Stages (illustrative, to be replaced by measured usage): extract claims from 3 sources, outline, write 7 paragraphs, judge about 28 sentences, adversarial review.
- Provisional rates: writer $0.10/$0.50, judge $2/$10 per MTok. Not read from the owner's account.
- Results: cost per attempt about $0.10 (no thinking, no search). Per accepted story: $0.21 at 50% acceptance, $0.31 at 33%, $0.69 at 15%. With 500 thinking tokens per call and 5 searches at 33%: $0.99 per accepted story. The judge stage is most of the cost, so a cheaper judge or fewer sentences judged moves the number most.
- Not in the worksheet: Cloudflare Workers Paid ($5/month if needed), a funded provider account, human review time.

## Hard cap (src/gen/ledger.ts reserveCall/settleCall/worstCaseMicro)
- Reserves the worst case of every call before it is made: prompt bytes (bounds tokens) at the input rate, plus max_tokens at the output rate (max_tokens includes billed thinking), plus every allowed search at its price.
- All reservations in flight or settled count, in order, one at a time (in D1: one conditional UPDATE). Failed calls keep their reservation; a smaller actual never frees cap; a larger actual pauses generation. Month is the month of reservation (UTC); a call that finishes after midnight stays in its reservation month, so check the provider invoice.
- The cap bounds what could be billed, not what was accepted.

## Prompts and fixture harness (src/gen/pipeline.ts, test/genpipe.test.ts)
- Prompts for extract, outline, write, judge, review. Quotes must occur in the source text; a candidate needs two independent source groups; disputed claims only as disagreement; single-source claims attributed; numbers must appear in cited quotes; repeated facts, partly-supported sentences, reviewer defects, provider errors and cap refusals all reject.
- A passing candidate is only a candidate: labelled "not verified by a person and not independently proven", with licence flags.
- The harness runs on fixture responses. It proves refusal rules and orchestration. It does NOT show that any model writes good or true stories. Only a capped, approved pilot can.

## Not built, needs a paid test to learn
Whether claim-ledger writing raises acceptance and quality over the single-source pilot. The one thing that would settle it is a small capped test.
