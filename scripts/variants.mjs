// Saved-story reread, bonus read and motion sampling. Synthetic account only.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:8787'; const out = process.env.OUT || '/tmp/var'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(tag, w, h) {
  const page = await (await browser.createBrowserContext()).newPage(); await page.setViewport({ width: w, height: h });
  if (!process.env.NOSPOOF) await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '10.7.' + Math.floor(Math.random() * 250) + '.9' });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  const click = async (t) => { const [el] = await page.$$(`xpath/.//button[contains(., "${t}")]`); if (!el) throw new Error('no button ' + t); await el.click(); await wait(500); };
  const shot = (n) => page.screenshot({ path: `${out}/${tag}-${n}.png` });
  await page.goto(base + '?daypart=day'); await page.waitForSelector('.welcome', { timeout: 60000 }); await wait(2000);
  await click("Let's wander"); await page.waitForSelector('form'); await page.type('input[type=email]', `synthetic-var-${tag}-${Date.now()}@example.test`); await page.type('input[type=password]', 'password-synth1'); await click('Start my 3 free days');
  await page.waitForSelector('select'); await click('Next'); await page.waitForSelector('.chips'); await click('everyday life'); await click('Next'); await click('Skip'); await click('A flowing story'); await click('Next'); await click('All set');
  await page.waitForSelector('.nav'); await wait(1000);
  // motion: sample opacity/transform of the incoming article every frame
  await page.evaluate(() => { window.__s = []; const t0 = performance.now(); const tick = () => { const a = document.querySelector('main article'); if (a) { const cs = getComputedStyle(a); window.__s.push([Math.round(performance.now() - t0), +(+cs.opacity).toFixed(2), cs.transform === 'none' ? 0 : Math.round(+cs.transform.split(',')[5])]); } if (performance.now() - t0 < 900) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await click('Go down this rabbit hole'); await wait(900);
  const s = await page.evaluate(() => window.__s); const f = (x) => x.filter((_, i) => i % Math.ceil(x.length / 10) === 0).map((r) => r.join('/')).join(' ');
  console.log(tag, 'motion [ms/opacity/translateY]:', s.length, 'frames:', f(s));
  await page.evaluate(() => window.scrollTo(0, 99999)); await wait(400);
  await click('Save for later'); await click("I'm done reading"); await wait(1200);
  if (process.env.BONUS) { await page.evaluate(() => window.scrollTo(0,0)); await page.evaluate(() => [...document.querySelectorAll('.nav button')].find((x) => x.textContent.includes('Explore')).click()); await wait(900); const [b] = await page.$$('xpath/.//button[contains(., "tiny detour")]'); if (b) { await b.evaluate((x) => x.click()); await wait(1500); console.log('TXT', (await page.evaluate(() => document.querySelector('main').innerText)).slice(0,160).replace(/\n/g,' | ')); await shot('bonus-top'); await page.evaluate(() => window.scrollTo(0, 700)); await wait(300); await shot('bonus-q'); await page.evaluate(() => window.scrollTo(0, 99999)); await wait(500); await shot('bonus-end'); console.log(tag,'bonus rendered'); await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('back up')).click()); await wait(500); } else console.log(tag,'no bonus button'); }
  await click('You'); await wait(900);
  const [lnk] = await page.$$('.journal .linklike'); if (!lnk) throw new Error('no saved story'); await lnk.click(); await wait(1200);
  await shot('saved-top'); await page.evaluate(() => window.scrollTo(0, 700)); await wait(300); await shot('saved-q'); await page.evaluate(() => window.scrollTo(0, 99999)); await wait(500); await shot('saved-end');
  console.log(tag, 'saved view errors:', errs.length ? errs.slice(0, 3) : 'none');
  await page.close();
}
await run('m', 390, 780); await run('d', 1280, 800); await browser.close();
