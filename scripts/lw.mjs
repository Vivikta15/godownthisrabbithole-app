import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); const W=+process.env.W||390; await page.setViewport({ width: W, height: 780 });
const errs=[]; page.on('pageerror',e=>errs.push(String(e))); page.on('console',m=>m.type()==='error'&&errs.push(m.text()));
const click = async (t) => { const [h] = await page.$$(`xpath/.//button[contains(., "${t}")]`); if(!h) throw new Error('no '+t); await h.click(); }; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot=async(n)=>{await wait(1500);const ov=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(ov)console.log('OVERFLOW',n);await page.screenshot({path:`/tmp/lw-${W}-${n}.png`});};
await page.goto(process.env.BASE || 'http://localhost:8787'); await page.waitForSelector('.go'); await shot('welcome');
await click("Let's wander"); await page.waitForSelector('form'); await shot('auth');
await page.type('input[type=email]', `lw${Date.now()}@example.test`); await page.type('input[type=password]', 'password1');await page.type('form input:not([type=email]):not([type=password])', 'Jo');
await click('Start my 3 free days'); await wait(2500); console.log((await page.evaluate(()=>document.body.innerText)).slice(0,300)); await shot('quiz');
await page.select('select','IN').catch(()=>{}); await click('Next'); await wait(400); await click('space'); await click('Next'); await wait(400); await click('Next').catch(()=>{}); await wait(400);
for (let i=0;i<6;i++){ for (const c of ['A flowing story','A good chew']) { const [h]=await page.$$(`xpath/.//button[contains(., "${c}")]`); if(h) await h.click(); } const t=await page.evaluate(()=>[...document.querySelectorAll('button.go')].map(b=>b.textContent)); if(t.includes('All set')){await click('All set');break;} if(t.length) await click(t[0]); await wait(500); }
await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>/Go down this rabbit hole/.test(b.textContent)),{timeout:8000}).catch(async()=>{console.log('STUCK:',(await page.evaluate(()=>document.body.innerText)).slice(0,400));await shot('stuck');throw new Error('stuck')}); await shot('today');
await click('Go down this rabbit hole'); await wait(1500); await page.evaluate(() => window.scrollTo(0, 400)); await shot('reading');
await page.evaluate(() => window.scrollTo(0, 0));
for (const t of ['Explore','Connections','Trail','You']) { await click(t); await shot(t); }
console.log('errors', errs.slice(0,4)); await browser.close();
