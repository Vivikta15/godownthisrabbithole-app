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

## Cost per ACCEPTED story (forecast, not measured)
Assumptions: 7 paragraphs, about 49k input and 10.5k output tokens per attempt (scaled from the pilot's 42k in and 9k out over 6 runs), 3 sources (input x3), 1.5x retries, Haiku 5.5 writer at $0.10/$0.50 per M, Sonnet 5.5 judge at $2/$10 per M, judge handles half the tokens. Cost per accepted = attempt cost divided by acceptance.
- acceptance 1/2: about $0.06 (all Haiku), $0.63 (half Sonnet), $1.20 (all Sonnet)
- acceptance 1/3 (the pilot's rate): $0.09, $0.94, $1.80
- acceptance 0.15: $0.20, $2.09, $3.99
Not included: search calls ($10 per 1,000 on the Anthropic API), thinking tokens, Cloudflare Workers Paid ($5/month if the app needs more than 50 subrequests per invocation), a funded API account.
My earlier "$0.03 to $0.65" omitted dividing by acceptance. Use these numbers.

## Not built, needs a paid test to learn
Whether claim-ledger writing raises acceptance and quality over the single-source pilot. The one thing that would settle it is a small capped test.
