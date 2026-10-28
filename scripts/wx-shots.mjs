// Weather layers + city setting walkthrough. Synthetic account only; ?weather= previews layers without any weather call.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:8787'; const out = process.env.OUT || '/tmp/wx'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(tag, w, h) {
  const email = `synthetic-wx-${tag}-${Date.now()}@example.test`;
  const page = await (await browser.createBrowserContext()).newPage(); await page.setViewport({ width: w, height: h }); await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '10.8.' + Math.floor(Math.random()*250) + '.' + Math.floor(Math.random()*250) });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  const click = async (t) => { const [el] = await page.$$(`xpath/.//button[contains(., "${t}")]`); if (!el) throw new Error('no button ' + t); await el.click(); };
  const shot = (n) => page.screenshot({ path: `${out}/${tag}-${n}.png` });
  for (const wx of ['cloudy', 'rain', 'mist']) { await page.goto(`${base}?daypart=day&weather=${wx}`); await page.waitForSelector('.welcome'); await wait(1600); await shot('welcome-' + wx); }
  await page.goto(`${base}?daypart=dusk&weather=rain`); await wait(1500); await shot('welcome-dusk-rain');
  await page.goto(`${base}?daypart=day&weather=rain`); await page.waitForSelector('.welcome');
  await click("Let's wander"); await page.waitForSelector('form'); await page.type('input[type=email]', email); await page.type('input[type=password]', 'password-synth1'); await click('Start my 3 free days');
  await page.waitForSelector('select'); await click('Next'); await page.waitForSelector('.chips'); await click('everyday life'); await click('Next'); await wait(200); await click('Skip'); await wait(200); await click('A flowing story'); await click('Next'); await wait(200); await click('All set');
  await page.waitForSelector('.nav'); await wait(1200); await shot('explore-rain');
  await click('Go down this rabbit hole'); await wait(900); await page.evaluate(() => window.scrollTo(0, 400)); await wait(900); await shot('reading-rain');
  await page.goto(`${base}?daypart=day`); await page.waitForSelector('.nav'); await click('You'); await wait(800);
  await page.type('#cityq', 'delh'); await wait(900); await page.evaluate(() => document.querySelector('.citybox').scrollIntoView()); await wait(300); await shot('you-city-search');
  const r = await page.evaluate(async () => { const a = await (await fetch('/api/city', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 1273294 }) })).json(); const b = await (await fetch('/api/city')).json(); const bad = await fetch('/api/city', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: -5 }) }); const w = await (await fetch('/api/config')).json(); return { a, b, bad: bad.status, weatherCfg: w.weather }; });
  console.log(tag, JSON.stringify(r)); console.log(tag, 'errors:', errs.length ? errs.slice(0, 3) : 'none'); await page.close();
}
await run('wx-m', 390, 780); await run('wx-d', 1280, 800); await browser.close();
