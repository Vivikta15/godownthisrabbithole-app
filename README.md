# godownthisrabbithole (fresh build)

Daily personalized "rabbit hole" story, quiz, streaks with freezes, friends leaderboard, Connection Finder, trial and paid plans. Separate from any earlier version.

## Status
Works locally: accounts, quiz, daily pick, reader, streaks/freezes, friends, entitlements, Dodo webhook signature check.
Not done: real content generator and source verification, Connection Finder (returns 503 on purpose), Dodo checkout (501), deployment.
Sample stories in `src/content/seed.ts` are marked "source check pending"; claims are not verified.

## Run locally
    npm install
    npm run build
    npm run db:local        # applies migrations/0001_init.sql to local D1
    npm run dev:api         # http://localhost:8787
    npm test                # unit tests
    node scripts/e2e.mjs    # API checks, needs dev:api running

## Config (undecided values live in src/shared/config.ts, null = to be decided)
$3 plan freezes, billing cadence, streak miss rule, bonus chance.

## Secrets / env (never commit)
- DODO_WEBHOOK_SECRET: Dodo test-mode webhook secret (wrangler secret)
- Later: Dodo API key (test mode), LLM provider key
- Deploy: Cloudflare API token (Workers + D1 edit), set CLOUDFLARE_API_TOKEN

## Deploy (when access exists)
1. `wrangler d1 create rabbithole-prod`, put the id in wrangler.jsonc
2. `wrangler d1 migrations apply rabbithole-prod --remote`
3. `wrangler secret put DODO_WEBHOOK_SECRET`
4. `npm run build && wrangler deploy`
Dodo stays in test mode until the owner approves going live.

## Tests and migrations
- `npm test`: unit tests (streak math, entitlements incl. trial expiry and past_due grace, webhook signature, Dodo event mapping, source-check pipeline).
- `node scripts/e2e.mjs` (needs `npm run dev:api`): real Worker + D1. Covers auth, quiz, today, reads, friends, parallel /today and parallel completions, cross-user access, malformed JSON, cross-origin POST, login throttle.
- Migrations: 0001_init.sql (schema), 0002_login_attempts.sql (login throttle).
- Env (non-secret): DODO_PRODUCT_MAP = JSON mapping Dodo product ids to plan3/plan5. It is the authority for the plan on plan changes.
- Known gaps: no IP-level rate limit, no email verification or password reset, trial-expiry and session-expiry covered by unit logic and a code check only, not by e2e with a moved clock.

## Known issues / checkpoint (keep updated)
- Journey test (scripts/journey.mjs, 20 assertions at 320 and 390 px) uses REAL pointer clicks in an isolated browser context. Observed at 13:19-13:26: in puppeteer's DEFAULT browser context real mouse events stopped reaching the page on the Today screen (document-level capture listeners saw none, hasFocus() false) while DOM clicks worked; with createBrowserContext() real clicks work for all three stories tried (Venus, emu, Oxford). Mascot, dock and animations were ruled out by removal. The root cause in the default context is not identified; no touch test was completed. Still verify real pointer and touch on a deployed build in a real browser.
- AI: src/worker/aibudget.ts is a guard only. It is NOT wired to any model. Do not enable real calls until free-only enforcement is proven (the guard's per-call estimate does not by itself stop spend if the account is on Workers Paid or shares usage). Verify the account plan and token/output limits first; otherwise leave AI off.
- Length preference is stored but not applied to sample stories (only topic and format adapt).
- GitHub push: vault item "GitHub push token" held a value GitHub rejected at 13:17; a fresh vault link was issued. Push by URL, not by editing remotes: `git push https://github.com/Vivikta15/godownthisrabbithole-app.git master:main` with the token supplied through GIT_CONFIG_* http.extraheader from the vault file; never print the value.
- Sample story content is hand-written and unverified; sources are not fetched.

## What works today (local only) vs not
Works (real Worker + D1, local): email/password accounts with sessions; one-time quiz (topics, story style, length); daily pick chosen by an explainable score (quiz + read history + exploration); reader with honest "sources not checked" label; streaks with freezes (2 in trial, 5 on $5, $3 undecided) and a friends leaderboard via invite codes; trial/entitlement rules; Dodo webhook verification and subscription mapping (unit-tested against documented shapes only); no-spend AI guard (not connected); Wikipedia source fetcher (stub-tested; not run live); mascot with animations in its own bottom strip.
Not working / stubbed: no real story generation, Connection Finder refuses (503), no email verification/password reset, no IP rate limiting, not deployed, not pushed.
Accessibility checked (script audit at 390px): lang, page title, main landmark, every input labelled, no unnamed buttons, focus outline. Not checked: colour contrast, screen reader run, reduced-motion in a browser.

## Update 2026-10-27 (later)
- Source check: all six sample stories were compared claim by claim against fetched en.wikipedia.org text; revision ids are in src/content/seed.ts (`checked`). Four stories had claims the source did not support (wombat, octopus, emu war, oxford); fixed. The UI says "compared by hand ... one source, not independent verification". It is not called verified.
- Checkout: src/worker/checkout.ts creates a Dodo checkout session (test endpoint only). Needs CHECKOUT_ENABLED=true, DODO_API_KEY, DODO_PRODUCT_MAP, APP_URL. Refuses live mode. Sends no trial period (undecided). Never run against Dodo yet; unit-tested with a fake fetch.
- Bonus holes: env BONUS_CHANCE (0..1) decides earning; unset = nobody earns (undecided rule). Redeem is atomic (/api/bonus/redeem) and does not extend streaks.
- Contrast: computed WCAG ratios. White text on the orange button was 2.35:1, now dark text (5.0:1); note text darkened to 5.5:1; focus ring darkened to 4.95:1. Accessibility tree checked for the sign-up and quiz screens only.
