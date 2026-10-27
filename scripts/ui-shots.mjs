// Walks welcome -> quiz -> explore -> reading -> done -> connections -> trail -> you at phone and desktop sizes. Synthetic account only.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:8787'; const out = process.env.OUT || '/tmp/ui'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(tag, w, h) {
  const page = await (await browser.createBrowserContext()).newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await page.emulateTimezone('Asia/Calcutta'); await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '10.' + Math.floor(Math.random()*250) + '.' + Math.floor(Math.random()*250) + '.' + Math.floor(Math.random()*250) });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const click = async (t) => { const [el] = await page.$$(`xpath/.//button[contains(., "${t}")]`); if (!el) throw new Error('no button ' + t); await el.click(); };
  const shot = (n) => page.screenshot({ path: `${out}/${tag}-${n}.png` });
  await page.goto(base); await page.waitForSelector('.welcome'); await wait(2800); await shot('1-welcome');
  await click("Let's wander"); await page.waitForSelector('form'); await page.type('input[type=email]', `synthetic-ui-${tag}-${Date.now()}@example.test`); await page.type('input[type=password]', 'password-synth1'); await click('Start my 3 free days');
  await page.waitForSelector('select'); await shot('2-quiz'); await click('Next'); await page.waitForSelector('.chips'); await click('everyday life'); await click('money & tech'); await click('Next'); await wait(200); await click('To understand'); await click('Next'); await wait(200); await click('A flowing story'); await click('Next'); await wait(200); await page.type('input[type=text]', 'tea'); await click('All set');
  await page.waitForSelector('.nav'); await wait(1000); await shot('3-explore');
  await click('Go down this rabbit hole'); await wait(800); await page.evaluate(() => window.scrollBy(0, 500)); await wait(300); await shot('4-reading');
  await page.evaluate(() => window.scrollTo(0, 99999)); await wait(400); await shot('5-reading-end');
  await click("I'm done reading"); await wait(1500); await shot('6-done');
  await click('Connections'); await wait(600); await shot('7-connections');
  await click('Trail'); await wait(900); await shot('8-trail');
  await click('You'); await wait(900); await shot('9-you');
  console.log(tag, 'errors:', errs.length ? errs.slice(0, 3) : 'none', 'overflowX:', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await page.close();
}
await run('m', 390, 780); await run('d', 1280, 800); await browser.close();
