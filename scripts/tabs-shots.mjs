import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 1 });
const click = async (t) => { const [h] = await page.$$(`xpath/.//button[contains(., "${t}")]`); await h.click(); }; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto(process.env.BASE || 'http://localhost:8787'); await page.waitForSelector('form'); await wait(3000);
await page.screenshot({ path: '/downloads/s-auth.png' });
await page.type('input[type=email]', `tab${Date.now()}@t.co`); await page.type('input[type=password]', 'password1'); await page.type('input[placeholder^="What should"]', 'Jo');
await click('Start my 3 free days'); await page.waitForSelector('.chips'); await page.screenshot({ path: '/downloads/s-quiz.png' });
for (const t of ['space', 'A flowing story', 'A good chew']) await click(t); await click('All set'); await page.waitForSelector('.card h1'); await wait(3000);
await page.screenshot({ path: '/downloads/s-today.png' });
await click('Jump in'); await wait(1500); await page.evaluate(() => window.scrollTo(0, 99999)); await wait(400); await page.screenshot({ path: '/downloads/s-storyend.png' });
await page.evaluate(() => window.scrollTo(0, 0));
for (const t of ['Connect', 'Streaks', 'Plan']) { await click(t); await wait(1200); await page.screenshot({ path: `/downloads/s-${t}.png`, fullPage: false }); }
await browser.close();
