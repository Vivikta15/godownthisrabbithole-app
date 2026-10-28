// Illustrated-world walkthrough: scenes across dayparts. Synthetic account only.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:8787'; const out = process.env.OUT || '/tmp/ui'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(tag, w, h) {
  const email = `synthetic-lake-${tag}-${Date.now()}@example.test`;
  const page = await (await browser.createBrowserContext()).newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await page.emulateTimezone('Asia/Calcutta'); await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '10.9.' + Math.floor(Math.random()*250) + '.' + Math.floor(Math.random()*250) });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  const click = async (t) => { const [el] = await page.$$(`xpath/.//button[contains(., "${t}")]`); if (!el) throw new Error('no button ' + t); await el.click(); };
  const shot = (n) => page.screenshot({ path: `${out}/${tag}-${n}.png` });
  await page.goto(base + '?daypart=day'); await page.waitForSelector('.welcome'); await wait(800); await shot('welcome-day');
  await click("Let's wander"); await page.waitForSelector('form'); await page.type('input[type=email]', email); await page.type('input[type=password]', 'password-synth1'); await click('Start my 3 free days');
  await page.waitForSelector('select'); await click('Next'); await page.waitForSelector('.chips'); await click('everyday life'); await click('Next'); await wait(200); await click('Skip'); await wait(200); await click('A flowing story'); await click('Next'); await wait(200); await click('All set');
  await page.waitForSelector('.nav'); await wait(1000); await shot('explore-day');
  await click('Go down this rabbit hole'); await wait(900); await shot('reading-top');
  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2)); await wait(400); await shot('reading-mid');
  await page.evaluate(() => window.scrollTo(0, 99999)); await wait(500); await shot('reading-end-caught');
  await click("I'm done reading"); await wait(1500); await shot('done-carrot');
  await click('Connections'); await wait(700); await shot('connections-day');
  await click('Trail'); await wait(900); await page.evaluate(() => window.scrollTo(0, 99999)); await wait(400); await shot('trail-day');
  // dusk on explore
  await page.goto(base + '?daypart=dusk'); await wait(1200); await shot('explore-dusk');
  // night on explore + reading
  await page.goto(base + '?daypart=night'); await wait(1200); await shot('explore-night');
  await click('Read it again'); await wait(700); await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2)); await wait(400); await shot('reading-night');
  console.log(tag, 'errors:', errs.length ? errs.slice(0, 3) : 'none');
  await page.close();
}
await run('lake-m', 390, 780); await run('lake-d', 1280, 800); await browser.close();
