import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:390,height:780});await p.goto('http://localhost:4173/motion.html');await new Promise(r=>setTimeout(r,2500));
const a=await p.screenshot({path:'/tmp/d-a.png'});await new Promise(r=>setTimeout(r,1000));await p.screenshot({path:'/tmp/d-b.png'});
await p.evaluate(()=>scrollTo(0,500));await new Promise(r=>setTimeout(r,200));await p.screenshot({path:'/tmp/d-c.png'});await new Promise(r=>setTimeout(r,1500));await p.screenshot({path:'/tmp/d-d.png'});
await b.close();
