// Mascot placement check on every main tab, mobile and desktop, top/middle/bottom scroll. Synthetic account only.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:8787'; const out = process.env.OUT || '/tmp/tabs'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(tag, w, h) {
  const email = `synthetic-tabs-${tag}-${Date.now()}@example.test`;
  const page = await (await browser.createBrowserContext()).newPage(); await page.setViewport({ width: w, height: h }); await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '10.7.' + Math.floor(Math.random()*250) + '.' + Math.floor(Math.random()*250) });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  const click = async (t) => { const [el] = await page.$$(`xpath/.//button[contains(., "${t}")]`); if (!el) throw new Error('no button ' + t); await el.click(); await wait(800); };
  await page.goto(base + '?daypart=day'); await page.waitForSelector('.welcome');
  await click("Let's wander"); await page.waitForSelector('form'); await page.type('input[type=email]', email); await page.type('input[type=password]', 'password-synth1'); await click('Start my 3 free days');
  await page.waitForSelector('select'); await click('Next'); await page.waitForSelector('.chips'); await click('everyday life'); await click('Next'); await wait(200); await click('Skip'); await wait(200); await click('A flowing story'); await click('Next'); await wait(200); await click('All set');
  await page.waitForSelector('.nav'); await wait(1000);
  for (const tab of ['Explore', 'Connections', 'Trail', 'You']) {
    await click(tab);
    // overlap test: at several scroll positions, does the mascot rectangle intersect any visible text node rectangle?
    const res = await page.evaluate(async () => {
      const m = document.querySelector('.mascot'); const bad = []; const H = document.documentElement.scrollHeight; const steps = 8;
      for (let i = 0; i <= steps; i++) {
        window.scrollTo(0, (H - innerHeight) * i / steps); await new Promise((r) => setTimeout(r, 60));
        const mr = m.getBoundingClientRect(); if (mr.bottom <= 0 || mr.top >= innerHeight) continue;
        const r = document.createRange();
        for (const e of document.querySelectorAll('main *, .shell > section *, .shell > article *')) {
          for (const n of e.childNodes) { if (n.nodeType !== 3 || !n.textContent.trim()) continue; r.selectNodeContents(n); for (const q of r.getClientRects()) { if (q.width && q.left < mr.right - 20 && q.right > mr.left + 20 && q.top < mr.bottom - 10 && q.bottom > mr.top + 10) bad.push([i, n.textContent.trim().slice(0, 30)]); } }
        }
      }
      return bad.slice(0, 4);
    });
    console.log(tag, tab, 'mascot/text overlaps:', JSON.stringify(res));
    await page.evaluate(() => window.scrollTo(0, 0)); await wait(200); await page.screenshot({ path: `${out}/${tag}-${tab}-top.png` });
    await page.evaluate(() => window.scrollTo(0, 99999)); await wait(300); await page.screenshot({ path: `${out}/${tag}-${tab}-bottom.png` });
  }
  console.log(tag, 'errors:', errs.length ? errs.slice(0, 3) : 'none'); await page.close();
}
await run('m', 390, 780); await run('d', 1280, 800); await browser.close();
