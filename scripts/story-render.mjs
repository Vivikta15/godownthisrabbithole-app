// Renders new stories via the creator library path on a synthetic account. Env: FMT (A flowing story|Questions and answers|Step by step), LEN (short|medium), W,H, OUT
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import { execSync } from 'node:child_process';
const base = process.env.BASE || 'http://localhost:8787'; const out = process.env.OUT || '/tmp/story'; fs.mkdirSync(out, { recursive: true });
const FMT = process.env.FMT || 'A flowing story', LEN = process.env.LEN || 'medium', W = +process.env.W || 390, H = +process.env.H || 780, TAG = process.env.TAG || 'x';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const email = `synthetic-story-${TAG}-${Date.now()}@example.test`;
const page = await (await browser.createBrowserContext()).newPage(); await page.setViewport({ width: W, height: H }); await page.emulateTimezone('Asia/Calcutta');
await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '10.8.' + Math.floor(Math.random()*250) + '.' + Math.floor(Math.random()*250) });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
const click = async (t) => { const [el] = await page.$$(`xpath/.//button[contains(., "${t}")]`); if (!el) throw new Error('no button ' + t); await el.click(); };
await page.goto(base); await page.waitForSelector('h1'); await wait(1500);
await click("Let's wander"); await page.waitForSelector('form'); await page.type('input[type=email]', email); await page.type('input[type=password]', 'password-synth1'); await click('Start my 3 free days');
await page.waitForSelector('select'); await click('Next'); await page.waitForSelector('.chips'); await click('history'); await click('Next'); await wait(200); await click('Skip'); await wait(200); await click(FMT); await click('Next'); await wait(300);
if (LEN === 'short') { try { await click('quick nibble'); } catch (e) { console.log('no length button'); } }
await click('All set'); await page.waitForSelector('.nav'); await wait(800);
execSync(`npx wrangler d1 execute rabbithole-app --local --command "INSERT INTO creator (user_id, created_at) SELECT id, 1 FROM users WHERE email='${email}'"`, { stdio: 'pipe' });
await page.reload(); await page.waitForSelector('.nav'); await wait(800);
await click('You'); await wait(800);
for (const [id, title] of [['dabbawala', 'The lunch that finds its own way'], ['chaturanga', 'The war game that became chess']]) {
  await click('You').catch(() => {}); await wait(500);
  const [b] = await page.$$(`xpath/.//button[contains(., "${title}")]`); if (!b) throw new Error('library missing ' + title);
  await b.click(); await wait(1800);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const shot = (n) => page.screenshot({ path: `${out}/${TAG}-${id}-${n}.png` });
  await shot('top'); await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2)); await wait(500); await shot('mid');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight - innerHeight - 700)); await wait(500); await shot('late');
  await page.evaluate(() => window.scrollTo(0, 99999)); await wait(700); await shot('end');
  const info = await page.evaluate(() => ({ paras: document.querySelectorAll('.story p, article p').length, recap: !!document.querySelector('.recap'), overflowX: document.documentElement.scrollWidth > innerWidth, text: document.body.innerText.length }));
  console.log(TAG, id, 'height', h, JSON.stringify(info));
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(300);
  const [back] = await page.$$(`xpath/.//button[contains(., "Back")]`); if (back) await back.click(); else await page.goBack(); await wait(700);
}
const ev = execSync(`npx wrangler d1 execute rabbithole-app --local --json --command "SELECT (SELECT count(*) FROM rabbit_holes WHERE user_id=u.id) rh, (SELECT count(*) FROM read_events WHERE user_id=u.id) ev, (SELECT current FROM streaks WHERE user_id=u.id) streak FROM users u WHERE email='${email}'"`).toString(); console.log('db after preview', ev.replace(/\s+/g,' ').slice(0, 300));
console.log(TAG, 'errors:', errs.length ? errs.slice(0, 3) : 'none'); await browser.close();
