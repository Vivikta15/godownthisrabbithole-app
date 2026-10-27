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
