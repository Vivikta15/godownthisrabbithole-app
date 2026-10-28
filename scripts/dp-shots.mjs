// Illustrated-world walkthrough: scenes across dayparts. Synthetic account only.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:8787'; const out = process.env.OUT || '/tmp/ui'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(tag, w, h) {
  const email = `synthetic-lake-${tag}-${Date.now()}@example.test`;
  const page = await (await browser.createBrowserContext()).newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await page.emulateTimezone('Asia/Calcutta'); if (!process.env.NOSPOOF) await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '10.9.' + Math.floor(Math.random()*250) + '.' + Math.floor(Math.random()*250) });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  const click = async (t) => { const [el] = await page.$$(`xpath/.//button[contains(., "${t}")]`); if (!el) throw new Error('no button ' + t); await el.click(); };
  const shot = (n) => page.screenshot({ path: `${out}/${tag}-${n}.png` });
  await page.goto(base + `?daypart=${process.env.DP}`); await page.waitForSelector('.welcome, .hero, h1', {timeout:60000}); await wait(2500); await shot('welcome-day');
  await click("Let's wander"); await page.waitForSelector('form'); await page.type('input[type=email]', email); await page.type('input[type=password]', 'password-synth1'); await click('Start my 3 free days');
  await page.waitForSelector('select'); await click('Next'); await page.waitForSelector('.chips'); await click('everyday life'); await click('Next'); await wait(200); await click('Skip'); await wait(200); await click('A flowing story'); await click('Next'); await wait(200); await click('All set');
  await page.waitForSelector('.nav'); await wait(1000); await shot('explore-day');
  await click('Go down this rabbit hole'); await wait(120); await shot('reading-anim'); await wait(800); await shot('reading-top');
  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2)); await wait(400); await shot('reading-mid'); await page.evaluate(() => window.scrollTo(0, 700)); await wait(300); await shot('reading-q');
  await page.evaluate(() => window.scrollTo(0, 99999)); await wait(500); await shot('reading-end-caught');
  await click("I'm done reading"); await wait(1500); await shot('done-carrot');
  await click('Connections'); await wait(700); await shot('connections-day');
  await click('Trail'); await wait(900); await page.evaluate(() => window.scrollTo(0, 99999)); await wait(400); await shot('trail-day');
  console.log(tag, 'errors:', errs.length ? errs.slice(0, 3) : 'none');
  await page.close();
}
await run(process.env.DP+'-m', 390, 780); await run(process.env.DP+'-t', 1024, 768); await run(process.env.DP+'-d', 1280, 800); await browser.close();
