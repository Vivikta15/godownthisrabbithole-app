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
