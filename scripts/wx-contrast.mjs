// Pixel contrast under weather tints: samples the real rendered background in text-free strips and compares with the text colours in use.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:8787'; fs.mkdirSync('/tmp/px', { recursive: true });
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const meta = {};
for (const dp of ['dawn', 'day', 'dusk', 'night']) for (const wx of ['none', 'cloudy', 'rain', 'mist']) {
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 780 });
  await p.goto(`${base}?daypart=${dp}${wx === 'none' ? '' : '&weather=' + wx}`); await p.waitForSelector('.welcome'); await new Promise((r) => setTimeout(r, 1500));
  await p.evaluate(() => document.querySelectorAll('.welcome *, .mascot, .lakewrap').forEach((e) => { e.style.visibility = 'hidden'; }));
  await p.screenshot({ path: `/tmp/px/${dp}-${wx}.png` });
  meta[dp] = await p.evaluate(() => { const cs = getComputedStyle(document.documentElement); const g = (n) => cs.getPropertyValue(n).trim(); return { ink: g('--ink'), soft: g('--soft'), coral: g('--coral'), moss: g('--moss'), amber: g('--amber') }; });
  await p.close();
}
fs.writeFileSync('/tmp/px/meta.json', JSON.stringify(meta)); await b.close();
