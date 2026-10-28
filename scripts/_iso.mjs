import puppeteer from 'puppeteer-core'; import { execSync } from 'node:child_process';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const out = [];
for (const role of ['normal','creator']) {
  const email = `synthetic-iso-${role}-${Date.now()}@example.test`;
  const p = await (await b.createBrowserContext()).newPage(); await p.setExtraHTTPHeaders({'cf-connecting-ip':'10.7.'+Math.floor(Math.random()*250)+'.'+Math.floor(Math.random()*250)});
  await p.goto('http://localhost:8787'); 
  const r = await p.evaluate(async (e) => { const j = (x)=>x; const s = await fetch('/api/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:e,password:'password-synth1'})}); return s.status; }, email);
  out.push(role+' signup '+r);
  if (role==='creator') execSync(`npx wrangler d1 execute rabbithole-app --local --command "INSERT INTO creator (user_id, created_at) SELECT id, 1 FROM users WHERE email='${email}'"`,{stdio:'pipe'});
  const q = () => execSync(`npx wrangler d1 execute rabbithole-app --local --json --command "SELECT (SELECT count(*) FROM rabbit_holes WHERE user_id=u.id) rh,(SELECT count(*) FROM read_events WHERE user_id=u.id) ev,(SELECT count(*) FROM streaks WHERE user_id=u.id) st FROM users u WHERE email='${email}'"`).toString().replace(/\s+/g,' ').match(/"rh": \d+, "ev": \d+, "st": \d+/)?.[0];
  const before = q();
  const res = await p.evaluate(async () => { const g = async (u)=>{const r=await fetch(u); return r.status;}; return { lib: await g('/api/creator/library'), dab: await g('/api/story/dabbawala'), chat: await g('/api/story/chaturanga') }; });
  out.push(role+' '+JSON.stringify(res)+' db before: '+before+' after: '+q());
}
console.log(out.join('\n')); await b.close();
