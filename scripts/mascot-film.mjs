// Records the mascot over time (frames every 120ms) through greet -> jump in -> reading -> pop out, to check real animation, not stills.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:8787'; const out = process.env.OUT || '/tmp/film'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 2 });
const click = async (t) => { const [h] = await page.$$(`xpath/.//button[contains(., "${t}")]`); await h.click(); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms)); let n = 0; const log = [];
async function film(label, ms) { const end = Date.now() + ms; while (Date.now() < end) { const el = await page.$('.mascot'); const st = await page.evaluate(() => document.querySelector('.mascot').dataset.state); const f = `${out}/${String(n++).padStart(3, '0')}-${label}.png`; await el.screenshot({ path: f }); log.push([f, st]); await wait(60); } }
await page.goto(base); await page.waitForSelector('form'); await film('greet', 3200);
await page.type('input[type=email]', `film${Date.now()}@t.co`); await page.type('input[type=password]', 'password1'); await page.type('input[placeholder^="What should"]', 'Jo');
await click('Start my 3 free days'); await page.waitForSelector('.chips'); for (const t of ['space', 'A flowing story', 'A good chew']) await click(t); await click('All set'); await page.waitForSelector('.card h1'); await wait(500);
await click('Jump in'); await film('jumpin', 1700); await film('reading', 1500);
await page.screenshot({ path: `${out}/reading-page.png` });
await page.evaluate(() => window.scrollTo(0, 99999)); await wait(300); await click("I'm done reading"); await film('popout', 2200);
fs.writeFileSync(`${out}/log.json`, JSON.stringify(log)); await browser.close();
const states = [...new Set(log.map((l) => l[1]))]; console.log('states seen in order:', log.map((l) => l[1]).filter((s, i, a) => i === 0 || a[i - 1] !== s).join(' > '), 'frames', log.length);
