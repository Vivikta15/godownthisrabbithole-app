# Account security: what exists, what is missing, what must happen before a public launch

Status: PREVIEW ONLY. Local tests do not make this production-ready auth.

Exists: PBKDF2-SHA256 (100k iterations) password hashes, random session ids in an HttpOnly cookie, same-origin check on POSTs, login throttle (8 failures per email per 15 minutes), JSON guard, security headers.

Missing (blocking a public launch):
1. Email verification. Anyone can sign up with an address they do not own.
2. Password reset. A forgotten password means a lost account.
3. IP-level rate limits for signup/login (only per-email login throttling exists).
4. Signup reveals whether an email is registered (409). Fix together with verification (always answer "check your email").
5. No session list or "log out everywhere"; no password change screen.
6. PBKDF2 iteration count is modest; Workers' WebCrypto limits apply. Review before launch.
7. Display names fall back to the email's local part on the friends board. Change to a neutral name before launch.

Design for 1 and 2 (needs an email provider the user chooses; none is connected, so none is built):
- Table auth_tokens(id, user_id, kind 'verify'|'reset', token_hash, expires_at, used_at). Store only a SHA-256 hash of a 32-byte random token.
- Verify: 24h expiry, single use, sets users.email_verified_at. Unverified accounts keep the trial but cannot invite friends or buy a plan.
- Reset: 1h expiry, single use, always responds the same whether or not the email exists, invalidates all sessions on success, throttled per email and per IP.
- Email sending: Cloudflare Email Service or another provider, sent from a domain with SPF/DKIM. Decision for the user: provider and sending domain. Cost not yet verified.
- Alternative that avoids passwords: passkeys/magic links (decision for the user: sign-in method, already listed as open).
