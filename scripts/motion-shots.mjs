import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:4173'; const out = process.env.OUT || '/tmp/motion'; fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [name, W, H] of [['mobile', 390, 780], ['desktop', 1280, 800]]) {
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 }); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  for (const t of [0.5, 3, 7]) { await page.goto(`${base}/motion.html?t=${t}`); await wait(1200); await page.screenshot({ path: `${out}/${name}-t${t}.png` }); }
  await page.goto(`${base}/motion.html`); await wait(1500);
  // live motion: grab hero canvas frames 0.5s apart and measure pixel change
  const frames = []; for (let i = 0; i < 5; i++) { frames.push(await page.screenshot({ clip: { x: 0, y: 0, width: W, height: Math.min(300, H * 0.5) }, encoding: 'base64' })); await wait(500); }
  fs.writeFileSync(`${out}/${name}-live-frames.json`, JSON.stringify(frames.length));
  frames.forEach((f, i) => fs.writeFileSync(`${out}/${name}-live-${i}.png`, Buffer.from(f, 'base64')));
  const info = await page.evaluate(() => ({ frames: window.__motion.frames(), paused: window.__motion.paused(), overflowX: document.documentElement.scrollWidth > innerWidth, canvasInArticle: !!document.querySelector('article canvas') }));
  await page.evaluate(() => window.scrollTo(0, 1e6)); await wait(600); await page.screenshot({ path: `${out}/${name}-bottom.png` });
  console.log(name, JSON.stringify(info), 'errors', errs.length ? errs.slice(0, 3) : 'none');
  // reduced motion
  const p2 = await browser.newPage(); await p2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await p2.setViewport({ width: W, height: H }); await p2.goto(`${base}/motion.html`); await wait(1000); const f1 = await p2.evaluate(() => window.__motion.frames()); await wait(1200); const f2 = await p2.evaluate(() => window.__motion.frames()); console.log(name, 'reduced-motion paused', await p2.evaluate(() => window.__motion.paused()), 'frames', f1, f2); if (name === 'mobile') await p2.screenshot({ path: `${out}/mobile-reduced.png` });
}
await browser.close();
