// Keyboard-only walkthrough + touch-target and focus-ring measurements. Synthetic account only.
import puppeteer from 'puppeteer-core';
const base = process.env.BASE || 'http://localhost:8787';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await (await browser.createBrowserContext()).newPage(); await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 2, hasTouch: true }); await page.emulateTimezone('Asia/Calcutta');
await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '10.' + Math.floor(Math.random()*250) + '.9.' + Math.floor(Math.random()*250) });
const active = () => page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { tag: e.tagName, name: (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.type || '').slice(0, 30), outline: cs.outlineStyle + ' ' + cs.outlineWidth }; });
const tabTo = async (pred, max = 25) => { for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); const a = await active(); if (pred(a)) return a; } throw new Error('tab target not found; last focus ' + JSON.stringify(await active())); };
const log = []; const L = (...a) => { log.push(a.join(' ')); console.error('LOG', a.join(' ').slice(0, 300)); };
await page.goto(base + (process.env.DAYPART ? '?daypart=' + process.env.DAYPART : '')); await page.waitForSelector('.welcome');
let a = await tabTo((x) => x.name.includes("Let's wander")); L('welcome focus:', JSON.stringify(a)); await page.keyboard.press('Enter');
await page.waitForSelector('form.auth');
await tabTo((x) => x.tag === 'INPUT' && x.name.includes('text')); await page.keyboard.type('Synth');
await page.keyboard.press('Tab'); await page.keyboard.type(`synthetic-kb-${Date.now()}@example.test`); await page.keyboard.press('Tab'); await page.keyboard.type('password-synth1'); await page.keyboard.press('Enter');
await page.waitForSelector('select'); L('signup by keyboard: ok');
// quiz: next with keyboard
await tabTo((x) => x.name === 'Next'); await page.keyboard.press('Enter'); await page.waitForSelector('.chips');
a = await tabTo((x) => x.name === 'everyday life'); L('chip focus:', JSON.stringify(a)); await page.keyboard.press('Space');
const pressed = await page.evaluate(() => document.activeElement.getAttribute('aria-pressed')); L('chip toggled by Space:', pressed);
await tabTo((x) => x.name === 'Next'); await page.keyboard.press('Enter'); await wait(200);
L('step now:', await page.evaluate(() => document.querySelector('main h1')?.textContent + ' | active=' + document.activeElement.tagName)); await tabTo((x) => x.name === 'Skip'); await page.keyboard.press('Enter'); await wait(200);
await tabTo((x) => x.name === 'A flowing story'); await page.keyboard.press('Space'); await tabTo((x) => x.name === 'Next'); await page.keyboard.press('Enter'); await wait(200);
await tabTo((x) => x.name === 'All set'); await page.keyboard.press('Enter'); await page.waitForSelector('.nav'); await wait(900);
L('quiz finished by keyboard: ok');
// nav and explore
a = await tabTo((x) => x.name.includes('Explore')); L('nav focus:', JSON.stringify(a));
await tabTo((x) => x.name.includes('Go down')); await page.keyboard.press('Enter'); await wait(500);
const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent); L('reading opened by keyboard:', h1);
await tabTo((x) => x.name.includes('done reading'), 40); await page.keyboard.press('Enter'); await wait(1200);
L('finish by keyboard:', (await page.evaluate(() => document.querySelector('h1')?.textContent)));
await page.screenshot({ path: '/tmp/ui/a11y-focus.png' });
// touch targets across screens
const small = async (label) => { const r = await page.evaluate(() => [...document.querySelectorAll('button,a[href],input,select')].filter((e) => e.offsetParent !== null).map((e) => { const b = e.getBoundingClientRect(); return { n: (e.getAttribute('aria-label') || e.innerText || e.placeholder || '').slice(0, 24), w: Math.round(b.width), h: Math.round(b.height), inline: !!e.closest('p.note,p.sources,.fine,.kicker') && e.tagName === 'A' }; }).filter((x) => (x.w < 44 || x.h < 44) && !x.inline)); L(label, 'targets under 44px:', JSON.stringify(r)); };
await small('explore');
const click = async (t) => { const [el] = await page.$$(`xpath/.//button[contains(., "${t}")]`); await el.click(); await wait(700); };
await click('Connections'); await small('connections'); await click('Trail'); await small('trail'); await click('You'); await small('you');
const you = await page.evaluate(() => document.querySelector('.plan-block')?.innerText); L('PLAN TEXT:', you.replace(/\n+/g, ' | '));
await page.evaluate(() => document.querySelector('.plan-block')?.scrollIntoView()); await wait(300); await page.screenshot({ path: '/tmp/ui/m-you-plan.png' });
// rendered text contrast on each screen (effective background found by walking up; ignores images)
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = async (label) => { const r = await page.evaluate(() => { const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number); const out = []; const seen = new Set();
  for (const e of document.querySelectorAll('main *, .nav *')) { if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') continue; const cs = getComputedStyle(e); const fg = parse(cs.color); let bgc = null; let n = e; while (n) { const b = parse(getComputedStyle(n).backgroundColor); if (b.length >= 3 && (b.length === 3 || b[3] > 0.9)) { bgc = b; break; } n = n.parentElement; } bgc = bgc || [17, 20, 16]; const key = cs.color + bgc.join(',') + cs.fontSize; if (seen.has(key)) continue; seen.add(key); out.push({ t: e.textContent.trim().slice(0, 30), fg, bg: bgc.slice(0, 3), size: parseFloat(cs.fontSize), bold: parseInt(cs.fontWeight) >= 700, dis: e.closest('button')?.disabled || false }); } return out; });
  const bad = r.map((x) => ({ ...x, ratio: (Math.max(lum(x.fg), lum(x.bg)) + 0.05) / (Math.min(lum(x.fg), lum(x.bg)) + 0.05) })).filter((x) => x.ratio < ((x.size >= 24 || (x.size >= 18.66 && x.bold)) ? 3 : 4.5) && !x.dis);
  L(label, 'text styles checked:', r.length, 'below WCAG AA:', JSON.stringify(bad.map((x) => [x.t, x.ratio.toFixed(2)])));
  // placeholders + control borders
  };
await contrast('you');
await click('Explore'); await contrast('explore'); await click('Connections'); await contrast('connections'); await click('Trail'); await contrast('trail');
console.log(log.join('\n')); await browser.close();
