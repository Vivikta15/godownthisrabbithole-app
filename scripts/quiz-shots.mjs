// Walks the 5-step quiz and the first Today page against a local dev server, saving screenshots. Synthetic account only.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:8787'; const out = process.env.OUT || '/tmp/quiz'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await (await browser.createBrowserContext()).newPage(); await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 2 }); await page.emulateTimezone('Asia/Calcutta');
const click = async (t) => { const [h] = await page.$$(`xpath/.//button[contains(., "${t}")]`); await h.click(); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto(base); await page.waitForSelector('form');
await page.type('input[type=email]', `synthetic-quiz-${Date.now()}@example.test`); await page.type('input[type=password]', 'password-synth1'); await click('Start my 3 free days');
await page.waitForSelector('select'); await wait(500); await page.screenshot({ path: `${out}/q1-country.png` });
await click('Next'); await page.waitForSelector('.chips'); await click('everyday life'); await click('money & tech'); await page.screenshot({ path: `${out}/q2-topics.png` });
await click('Next'); await wait(300); for (const w of (process.env.WHY || 'To unwind').split('|')) await click(w); await page.screenshot({ path: `${out}/q3-why.png` });
await click('Next'); await wait(300); await click('A flowing story'); await page.screenshot({ path: `${out}/q4-style.png` });
await click('Next'); await wait(300); await page.type('input[type=text]', process.env.CURIOUS || 'how my phone knows my location'); await page.screenshot({ path: `${out}/q5-curious.png` });
await click('All set'); await page.waitForSelector('.tabs'); await wait(1200); await page.screenshot({ path: `${out}/today.png` });
await click('Jump in'); await wait(1500); await page.evaluate(() => window.scrollBy(0, 99999)); await wait(300); await page.screenshot({ path: `${out}/story.png` });
console.log('HAS_TELL', (await page.evaluate(() => document.body.innerText)).includes('Tell someone')));
console.log((await page.evaluate(() => document.querySelector('h2, h1')?.textContent)), '|', await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n/g, ' / ')));
await browser.close();
