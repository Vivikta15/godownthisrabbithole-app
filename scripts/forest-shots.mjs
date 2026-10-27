import puppeteer from 'puppeteer-core'; import { execSync } from 'child_process';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const day = (k) => { const d = new Date(Date.now() + 5.5 * 3600e3); d.setUTCDate(d.getUTCDate() - k); return d.toISOString().slice(0, 10); };
const d1 = (sql) => execSync(`npx wrangler d1 execute rabbithole-app --local --json --command "${sql}"`, { stdio: 'pipe' }).toString();
async function mk(W, H, tag) {
  const page = await (await b.createBrowserContext()).newPage(); await page.setViewport({ width: W, height: H });
  await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '10.8.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) });
  const click = async (t) => { const [el] = await page.$$(`xpath/.//button[contains(., "${t}")]`); await el.click(); };
  const email = `synthetic-forest-${tag}-${Date.now()}@example.test`;
  await page.goto('http://localhost:8787'); await page.waitForSelector('.welcome'); await click("Let's wander"); await page.waitForSelector('form'); await page.type('input[type=email]', email); await page.type('input[type=password]', 'password-synth1'); await click('Start my 3 free days');
  await page.waitForSelector('select'); await click('Next'); await page.waitForSelector('.chips'); await click('places'); await click('Next'); await w(250); await click('Skip'); await w(250); await click('A flowing story'); await click('Next'); await w(250); await click('Skip');
  await page.waitForSelector('.nav', { timeout: 8000 }); await w(500);
  const uid = JSON.parse(d1(`SELECT id FROM users WHERE email='${email}'`))[0].results[0].id;
  return { page, click, uid };
}
for (const [W, H, tag] of [[390, 780, 'm'], [1280, 800, 'd']]) {
  // 1. success: finish today's story
  let { page, click } = await mk(W, H, tag + 's');
  await click('Go down this rabbit hole'); await w(400); await click("I'm done reading"); await page.waitForSelector('.scene.carrot'); await w(600);
  await page.screenshot({ path: `/tmp/ui/f-${tag}-success.png` });
  // 2. real broken streak: seed last read 6 days ago, no freezes (synthetic user only)
  ({ page, click, uid: globalThis.uid } = await mk(W, H, tag + 'f'));
  d1(`UPDATE streaks SET current=3, longest=3, last_read_day='${day(6)}', freezes_left=0 WHERE user_id='${globalThis.uid}'`);
  await page.reload(); await page.waitForSelector('.nav'); await page.waitForSelector('.scene.fox', { timeout: 6000 }); await w(1500);
  await page.evaluate(() => document.querySelector('.sceneblock').scrollIntoView({ block: 'center' })); await w(1200); await page.screenshot({ path: `/tmp/ui/f-${tag}-fox.png` }); await page.evaluate(() => scrollTo(0, 0));
  const cta = await page.evaluate(() => { const bt = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Go down this rabbit hole')); const r = bt.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; }); console.log(tag, 'fox-state CTA', JSON.stringify(cta));
  // 3. trail with seeded read days (fixture) and the preview section
  const hid = tag + Date.now();
  d1(`INSERT INTO rabbit_holes (id,user_id,day,topic_id,format,title,body,sources,verified) VALUES ('a${hid}','${globalThis.uid}','${day(1)}','honey','story','t','b','[]',0),('b${hid}','${globalThis.uid}','${day(2)}','octopus','story','t','b','[]',0)`);
  d1(`INSERT INTO read_events (id,user_id,hole_id,topic_tags,format,seconds_read,completed,day,created_at) VALUES ('fe1${tag}${Date.now()}','${globalThis.uid}','a${hid}','[]','story',100,1,'${day(1)}',${Date.now()}),('fe2${tag}${Date.now()}','${globalThis.uid}','b${hid}','[]','story',100,1,'${day(2)}',${Date.now()})`);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Trail').click()); await page.waitForSelector('.cal'); await page.evaluate(() => document.querySelector('details.scenes summary').click()); await w(800);
  await page.screenshot({ path: `/tmp/ui/f-${tag}-trail.png`, fullPage: true });
}
await b.close();
