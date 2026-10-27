// Needs the local dev server (BASE) and a local D1 with migrations. Plants tokens directly (no mail provider exists) and checks the reset flow.
import { execSync } from 'node:child_process'; import { createHash, randomBytes } from 'node:crypto';
const base = process.env.BASE || 'http://localhost:8787'; let fails = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + x)); if (!c) fails++; };
const call = async (path, body, jar = '', ip) => { const r = await fetch(base + '/api' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', cookie: jar, ...(ip ? { 'cf-connecting-ip': ip } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); return { status: r.status, jar: sc ? sc.split(';')[0] : jar, data: await r.json().catch(() => ({})) }; };
const sql = (q) => JSON.parse(execSync(`npx wrangler d1 execute rabbithole-app --local --json --command "${q}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))[0].results;
const sha = (t) => createHash('sha256').update(t).digest('hex');
sql(`DELETE FROM login_attempts WHERE key LIKE 'i:%'`);
const email = `rs${Date.now()}@t.co`; const s = await call('/signup', { email, password: 'old-password-1', name: 'Rae' });
const uid = sql(`SELECT id FROM users WHERE email='${email}'`)[0].id;
const plant = (kind, ttl) => { const raw = randomBytes(32).toString('hex'); sql(`INSERT INTO auth_tokens (id,user_id,kind,token_hash,expires_at,created_at) VALUES ('${raw.slice(0, 12)}','${uid}','${kind}','${sha(raw)}',${Date.now() + ttl},${Date.now()})`); return raw; };
ok('forgot is honestly unavailable while mail is off', (await call('/password/forgot', { email })).status === 501);
ok('garbage token rejected', (await call('/password/reset', { token: 'zzz', password: 'new-password-1' })).status === 400);
ok('short new password rejected', (await call('/password/reset', { token: plant('reset', 3600000), password: 'short' })).status === 400);
ok('verify token cannot reset a password', (await call('/password/reset', { token: plant('verify', 3600000), password: 'new-password-1' })).status === 400);
ok('expired token rejected', (await call('/password/reset', { token: plant('reset', -1000), password: 'new-password-1' })).status === 400);
const good = plant('reset', 3600000);
ok('session works before reset', (await call('/me', undefined, s.jar)).status === 200);
const race = await Promise.all([1, 2, 3].map(() => call('/password/reset', { token: good, password: 'new-password-1' })));
ok('parallel use of one token: exactly one succeeds', race.filter((r) => r.status === 200).length === 1, JSON.stringify(race.map((r) => r.status)));
ok('old session is logged out by reset', (await call('/me', undefined, s.jar)).status === 401);
ok('old password no longer works', (await call('/login', { email, password: 'old-password-1' })).status === 401);
ok('new password works', (await call('/login', { email, password: 'new-password-1' })).status === 200);
ok('token cannot be reused', (await call('/password/reset', { token: good, password: 'another-pass-1' })).status === 400);
const v = plant('verify', 3600000); ok('email verify works once', (await call('/email/verify', { token: v })).status === 200 && (await call('/email/verify', { token: v })).status === 400);
ok('email_verified_at set', sql(`SELECT email_verified_at v FROM users WHERE id='${uid}'`)[0].v > 0);

// per-IP signup throttle (simulated client IP header; Cloudflare sets it for real)
const ipx = `203.0.113.${Math.floor(Math.random() * 200)}`; let last = 0;
for (let i = 0; i < 11; i++) last = (await call('/signup', { email: `ip${Date.now()}${i}@t.co`, password: 'password-123' }, '', ipx)).status;
ok('11th signup from one IP in an hour is 429', last === 429, String(last));
ok('a different IP is unaffected', (await call('/signup', { email: `ip${Date.now()}z@t.co`, password: 'password-123' }, '', ipx.replace(/\d+$/, '250'))).status === 200);
let lf = 0; for (let i = 0; i < 32; i++) lf = (await call('/login', { email: `nobody${i}@t.co`, password: 'wrong-password' }, '', '198.51.100.7')).status;
ok('login failures from one IP get throttled across emails', lf === 429, String(lf));
// optional verified-email gate (server started with --var REQUIRE_VERIFIED_EMAIL:true)
if (process.env.GATE) {
  const g = await call('/signup', { email: `g${Date.now()}@t.co`, password: 'password-123' }); const gid = sql(`SELECT id FROM users WHERE email LIKE 'g%@t.co' ORDER BY signup_at DESC LIMIT 1`)[0].id;
  ok('gate on: invite blocked before verification', (await call('/invite', {}, g.jar)).status === 403);
  const raw = randomBytes(32).toString('hex'); sql(`INSERT INTO auth_tokens (id,user_id,kind,token_hash,expires_at,created_at) VALUES ('${raw.slice(0, 12)}','${gid}','verify','${sha(raw)}',${Date.now() + 3600000},${Date.now()})`);
  await call('/email/verify', { token: raw }); ok('gate on: invite allowed after verification', (await call('/invite', {}, g.jar)).status === 200);
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
