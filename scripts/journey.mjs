// Browser journey test against local dev server (npm run dev:api). Asserts, not just screenshots.
import puppeteer from 'puppeteer-core';
const base = 'http://localhost:8787'; let fails = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + x)); if (!c) fails++; };
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
for (const w of [320, 390]) {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: w, height: 800 });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/status of (401|503)/.test(m.text()) && errs.push(m.text()));
  // Real pointer clicks, in an isolated browser context (in the default context real input stopped reaching the page; see README).
  const click = async (t) => { const [h] = await page.$$(`xpath/.//button[contains(., "${t}")]`); if (!h) throw new Error('no button ' + t); await h.click(); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = () => page.evaluate(() => document.body.innerText);
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await page.goto(base); await page.waitForSelector('form');
  await page.type('input[type=email]', `j${w}${Date.now()}@t.co`); await page.type('input[type=password]', 'password1'); await page.type('input[placeholder^="What should"]', 'Jo');
  await click('Start my 3 free days'); await page.waitForSelector('.chips');
  ok(`${w}: quiz shown, no overflow`, await noOverflow());
  for (const t of ['space', 'Questions and answers', 'A quick nibble']) await click(t);
  await click('All set'); await page.waitForSelector('.card h1');
  let t = await text();
  ok(`${w}: today shows a why-line`, /Because you like|fresh corner/.test(t), t.slice(0, 200));
  await wait(600); await click('Jump in'); await page.waitForSelector('article', { timeout: 8000 }); await wait(300);
  t = await text(); ok(`${w}: reader says sources not checked yet`, /have not been checked/i.test(t), t.slice(0, 300));
  ok(`${w}: reader open, no overflow`, await noOverflow());
  await click('Connect'); await page.waitForSelector('input[placeholder=moon]', { timeout: 8000 }); await page.type('input[placeholder=moon]', 'moon'); await page.type('input[placeholder=cheese]', 'cheese'); await click('Find the link'); await page.waitForFunction(() => /not switched on|fact engine|try|left/i.test(document.body.innerText) && !/Type two/.test(document.body.innerText.split('Find the link')[1] || ''), { timeout: 5000 }).catch(() => {}); await wait(300);
  t = await text(); ok(`${w}: finder says engine not on, invents nothing`, /not switched on|needs the fact engine/i.test(t), t.slice(0, 200));
  await click('Today'); await wait(300); await click("I'm done"); await wait(500);
  await click('Streaks'); await wait(500); t = await text(); ok(`${w}: streak is 1`, /\b1\b/.test(t));
  await click('Plan'); await wait(400); t = await text();
  ok(`${w}: plan page honest: payments off, undecided values flagged`, /not switched on/i.test(t) && /to be decided/i.test(t) && /monthly/i.test(t));
  ok(`${w}: no overflow on plan`, await noOverflow());
  const btn = await page.$$eval('button', (bs) => bs.filter((b) => /Payments not switched/.test(b.innerText)).every((b) => b.disabled));
  ok(`${w}: payment buttons disabled`, btn);
  ok(`${w}: no unexpected console errors`, errs.length === 0, JSON.stringify(errs));
  await page.close(); await ctx.close();
}
await browser.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
