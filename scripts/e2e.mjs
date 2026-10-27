// Run against `wrangler dev --local --port 8787 --var BONUS_CHANCE:1` (the bonus checks need it). Exercises the real Worker + D1.
const base = process.env.BASE || 'http://localhost:8787';
class Client { jar = ''; async call(path, body) {
  const r = await fetch(base + '/api' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', cookie: this.jar }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc) this.jar = sc.split(';')[0];
  return { status: r.status, data: await r.json().catch(() => ({})) }; } }
let fails = 0; const ok = (name, c, extra = '') => { console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + extra)); if (!c) fails++; };
const tag = Date.now();
const a = new Client(), b = new Client();
ok('unauthenticated /me is 401', (await new Client().call('/me')).status === 401);
ok('signup rejects short password', (await new Client().call('/signup', { email: 'x@y.co', password: '123' })).status === 400);
ok('signup', (await a.call('/signup', { email: `a${tag}@t.co`, password: 'password1', name: 'Ann', timezone: 'Asia/Calcutta' })).status === 200);
ok('duplicate email 409', (await new Client().call('/signup', { email: `a${tag}@t.co`, password: 'password1' })).status === 409);
let me = (await a.call('/me')).data;
ok('trial access, 2 freezes, not onboarded', me.access.plan === 'trial' && me.streak.freezesLeft === 2 && me.user.onboarded === false, JSON.stringify(me));
ok('today before quiz is 409', (await a.call('/today')).status === 409);
ok('quiz validation', (await a.call('/quiz', { interestTags: [], formats: [] })).status === 400);
ok('quiz', (await a.call('/quiz', { interestTags: ['space', 'history'], formats: ['qa'], length: 'short' })).status === 200);
const t1 = await a.call('/today'); ok('today returns a hole in qa format with sources', t1.status === 200 && t1.data.hole.format === 'qa' && t1.data.hole.sources.length > 0, JSON.stringify(t1.data).slice(0, 200));
const t2 = await a.call('/today'); ok('today is stable within a day', t2.data.hole.id === t1.data.hole.id);
const r1 = await a.call('/read', { holeId: t1.data.hole.id, seconds: 120, completed: true });
ok('read completes, streak 1', r1.status === 200 && r1.data.streak === 1, JSON.stringify(r1.data));
const r2 = await a.call('/read', { holeId: t1.data.hole.id, seconds: 30, completed: true });
ok('second read same day does not double count', r2.data.alreadyCounted === true);
ok('read of someone elses/unknown hole 404', (await a.call('/read', { holeId: 'nope', seconds: 1, completed: true })).status === 404);
me = (await a.call('/me')).data; ok('me shows readToday + streak 1', me.streak.readToday && me.streak.current === 1);
const f = await a.call('/finder', { a: 'moon', b: 'cheese' }); ok('finder honestly reports generator not connected', f.status === 503 && f.data.error === 'generator_not_connected');
ok('finder needs two words', (await a.call('/finder', { a: 'moon', b: '' })).status === 400);
ok('checkout rejects a missing plan', (await a.call('/checkout', {})).status === 400);
ok('checkout not configured (no key, not enabled)', (await a.call('/checkout', { plan: 'plan3' })).status === 501);
await b.call('/signup', { email: `b${tag}@t.co`, password: 'password1', name: 'Bo' });
const inv = (await a.call('/invite', {})).data.code; ok('invite code', typeof inv === 'string' && inv.length === 8);
ok('join bad code', (await b.call('/join', { code: 'zzzzzzzz' })).status === 400);
ok('join', (await b.call('/join', { code: inv })).status === 200);
const lb = (await a.call('/leaderboard')).data.board; ok('leaderboard shows both, Ann first with 1', lb.length === 2 && lb[0].name === 'Ann' && lb[0].streak === 1, JSON.stringify(lb));
ok('webhook without secret configured is 501', (await new Client().call('/webhooks/dodo', {})).status === 501);

// concurrency + abuse
const cc = new Client(); await cc.call('/signup', { email: `d${tag}@t.co`, password: 'password1', name: 'Dee' }); await cc.call('/quiz', { interestTags: ['space'], formats: ['qa'] });
const par = await Promise.all([cc.call('/today'), cc.call('/today'), cc.call('/today')]);
ok('parallel first /today all succeed with the same hole', par.every((x) => x.status === 200) && new Set(par.map((x) => x.data.hole?.id)).size === 1, JSON.stringify(par.map((x) => x.status)));
const hid = par[0].data.hole.id;
const rr = await Promise.all([1, 2, 3].map(() => cc.call('/read', { holeId: hid, seconds: 60, completed: true })));
ok('parallel completions count the streak once', (await cc.call('/me')).data.streak.current === 1, JSON.stringify(rr.map((x) => x.data)));
ok('another user cannot read my hole id', (await b.call('/read', { holeId: hid, seconds: 5, completed: true })).status === 404);

// length adaptation: short quiz -> fewer beats than medium for a 3-beat story (same topic forced via single interest)
const sh = new Client(), md = new Client();
for (const [c, len, n] of [[sh, 'short', 'sh'], [md, 'medium', 'md']]) { await c.call('/signup', { email: `${n}${tag}@t.co`, password: 'password1' }); await c.call('/quiz', { interestTags: ['space'], formats: ['qa'], length: len }); }
const hs = (await sh.call('/today')).data.hole, hm = (await md.call('/today')).data.hole;
ok('short preference never returns more beats than medium', hs.beats.length <= hm.beats.length, JSON.stringify([hs.beats.length, hm.beats.length, hs.id, hm.id]));

// security checks
const rawPost = (path, body, headers = {}) => fetch(base + '/api' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
ok('malformed JSON is 400 not 500', (await rawPost('/login', '{bad')).status === 400);
ok('cross-origin POST rejected', (await rawPost('/login', JSON.stringify({ email: 'a', password: 'b' }), { origin: 'https://evil.example' })).status === 403);
ok('correct login works', (await new Client().call('/login', { email: `b${tag}@t.co`, password: 'password1' })).status === 200);
let last = 0; for (let i = 0; i < 9; i++) last = (await new Client().call('/login', { email: `b${tag}@t.co`, password: 'wrongwrong' })).status;
ok('login throttled after repeated failures', last === 429, String(last));
ok('long display name is capped', ((await (async () => { const c = new Client(); await c.call('/signup', { email: `c${tag}@t.co`, password: 'password1', name: 'x'.repeat(500) }); return (await c.call('/me')).data; })()).user.name || '').length <= 40);

// bonus redemption (server started with --var BONUS_CHANCE:1)
const meC = (await cc.call('/me')).data; ok('bonus earned once (3 parallel reads counted once)', meC.streak.bonusHoles === 1, JSON.stringify(meC.streak));
const red = await Promise.all([1, 2, 3].map(() => cc.call('/bonus/redeem', {})));
ok('3 parallel redeems with 1 bonus: exactly one succeeds', red.filter((x) => x.status === 200).length === 1 && red.filter((x) => x.status === 409).length === 2, JSON.stringify(red.map((x) => x.status)));
const bh = red.find((x) => x.status === 200).data.hole;
ok('bonus hole is a different, unseen story', bh.bonus === true && bh.id !== hid && bh.beats.length > 0);
ok('bonus balance is now 0', (await cc.call('/me')).data.streak.bonusHoles === 0);
const br = await cc.call('/read', { holeId: bh.id, seconds: 60, completed: true });
ok('reading a bonus hole does not extend the streak', br.data.alreadyCounted === true && (await cc.call('/me')).data.streak.current === meC.streak.current);
ok('redeem with none left is 409', (await cc.call('/bonus/redeem', {})).status === 409);
ok('redeem needs login', (await new Client().call('/bonus/redeem', {})).status === 401);
await a.call('/logout', {}); ok('logout invalidates session', (await a.call('/me')).status === 401);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
