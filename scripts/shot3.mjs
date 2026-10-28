import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:390,height:780});await p.goto('http://localhost:4173/motion.html?t=5');await new Promise(r=>setTimeout(r,2500));
await p.evaluate(()=>scrollTo(0,innerHeight*0.9));await new Promise(r=>setTimeout(r,2500));await p.screenshot({path:'/tmp/m3-a.png'});
await p.evaluate(()=>scrollTo(0,innerHeight*0.55));await new Promise(r=>setTimeout(r,2500));await p.screenshot({path:'/tmp/m3-b.png'});await b.close();
