import puppeteer from 'puppeteer-core'; import { execSync } from 'child_process';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const w = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [tag, W, H] of [['m', 390, 780], ['d', 1280, 800]]) {
  const page = await (await b.createBrowserContext()).newPage(); await page.setViewport({ width: W, height: H });
  await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '10.9.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) });
  const click = async (t) => { const [el] = await page.$$(`xpath/.//button[contains(., "${t}")]`); await el.click(); };
  const email = `synthetic-vis-${tag}-${Date.now()}@example.test`;
  await page.goto('http://localhost:8787'); await page.waitForSelector('.welcome'); await click("Let's wander"); await page.waitForSelector('form'); await page.type('input[type=email]', email); await page.type('input[type=password]', 'password-synth1'); await click('Start my 3 free days');
  await page.waitForSelector('select'); await click('Next'); await page.waitForSelector('.chips'); await click('places'); await click('Next'); await w(250); await click('Skip'); await w(250); await click('A flowing story'); await click('Next'); await w(250); await click('Skip');
  await page.waitForSelector('.nav', { timeout: 8000 }); await w(600);
  // CTA reachability on first fold
  const cta = await page.evaluate(() => { const bt = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Go down this rabbit hole')); const r = bt.getBoundingClientRect(); const nav = document.querySelector('.nav').getBoundingClientRect(); const mas = document.querySelector('.mascot')?.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), navTop: Math.round(nav.top), mascotTop: mas ? Math.round(mas.top) : null, vh: innerHeight }; });
  console.log(tag, 'CTA', JSON.stringify(cta));
  await page.screenshot({ path: `/tmp/ui/v-${tag}-explore.png` });
  // seed real-looking read history for this synthetic user only
  const today = await page.evaluate(async () => { const t = JSON.parse(localStorage.getItem('rh_token') || 'null'); return null; });
  const id = execSync(`npx wrangler d1 execute rabbithole-app --local --json --command "SELECT id FROM users WHERE email='${email}'"`).toString(); const uid = JSON.parse(id)[0].results[0].id;
  const day = (k) => { const d = new Date(Date.now() + 5.5 * 3600e3); d.setUTCDate(d.getUTCDate() - k); return d.toISOString().slice(0, 10); };
  const ins = [0, 1, 2, 4, 5, 12, 13].map((k, i) => `INSERT INTO read_events (id,user_id,hole_id,topic_tags,format,seconds_read,completed,day,created_at) VALUES ('fx${tag}${i}','${uid}','h','[]','story',120,1,'${day(k)}',${Date.now()})`).join(';');
  execSync(`npx wrangler d1 execute rabbithole-app --local --command "${ins}; UPDATE streaks SET current=5, longest=5, last_read_day='${day(0)}', freezes_left=1 WHERE user_id='${uid}'"`, { stdio: 'pipe' });
  await page.evaluate(() => [...document.querySelectorAll('nav button, .nav button')].find((x) => x.innerText.includes('Trail')).click()); await w(300);
  await page.reload(); await page.waitForSelector('.nav'); await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Trail').click()); await page.waitForSelector('.cal'); await w(500);
  await page.screenshot({ path: `/tmp/ui/v-${tag}-trail.png`, fullPage: true });
  // finder with clearly synthetic fixture
  await page.setRequestInterception(true);
  page.on('request', (r) => r.url().endsWith('/api/finder') ? r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, a: { title: 'Moon', url: 'https://en.wikipedia.org/wiki/Moon' }, b: { title: 'Cheese', url: 'https://en.wikipedia.org/wiki/Cheese' }, bridge: { via: 'Earth', sentA: 'LAYOUT FIXTURE sentence from page A, not a live fetch.', sentB: 'LAYOUT FIXTURE sentence from page B, not a live fetch.' }, alternatives: [] }) }) : r.continue());
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Connections').click()); await page.waitForSelector('.pair-form');
  await page.type('input[placeholder=moon]', 'moon'); await page.type('input[placeholder=cheese]', 'cheese'); await click('Find the connection'); await page.waitForSelector('.bridge'); await w(300);
  await page.screenshot({ path: `/tmp/ui/v-${tag}-finder.png`, fullPage: true });
}
await b.close();
