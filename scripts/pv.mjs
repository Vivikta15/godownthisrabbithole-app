import puppeteer from 'puppeteer-core';
const B='https://rabbithole-app.godownthisrabbithole.workers.dev';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
for (const [dp,red] of [['day',false],['dusk',false],['night',false],['day',true]]) {
  const page = await (await browser.createBrowserContext()).newPage(); await page.setViewport({width:390,height:780});
  if (red) await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.goto(`${B}/?daypart=${dp}`); await page.waitForSelector('.go'); 
  for (const t of [1800,6000,9000]) { await wait(t===1800?1800:t===6000?4200:3000); await page.screenshot({path:`/tmp/pv-${dp}${red?'-rm':''}-${t}.png`}); }
  await page.close();
}
await browser.close();
