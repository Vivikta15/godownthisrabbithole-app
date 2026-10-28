import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const w=(ms)=>new Promise(r=>setTimeout(r,ms));
for(const [n,W,H] of [['m',390,780],['d',1280,800]]){const p=await b.newPage();await p.setViewport({width:W,height:H});const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('http://localhost:4173/motion.html?t=5');await w(2500);await p.screenshot({path:`/tmp/m2-${n}-0.png`});
await p.evaluate(()=>scrollTo(0,innerHeight*0.9));await w(2500);await p.screenshot({path:`/tmp/m2-${n}-1.png`});
await p.evaluate(()=>scrollTo(0,innerHeight*2.0));await w(2500);await p.screenshot({path:`/tmp/m2-${n}-2.png`});
console.log(n,await p.evaluate(()=>({f:window.__motion.frames(),ox:document.documentElement.scrollWidth>innerWidth})),errs.slice(0,3));}
await b.close();
