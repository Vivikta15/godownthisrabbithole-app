import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Mascot, useMascot } from './Mascot';
import type { MascotEvent } from '../shared/mascot';

type Me = { user: { email: string; name: string | null; onboarded: boolean }; access: { plan: string; rabbitHoles: boolean; finderQuota: { period: string; limit: number } | null; trialEndsAt: string }; streak: { current: number; longest: number; freezesLeft: number; bonusHoles: number; readToday: boolean }; prefs: any };
type Cfg = { topics: string[]; formats: { id: string; label: string }[]; plans: any; payments?: string };
type Send = (e: MascotEvent) => void;

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [mascot, send] = useMascot();
  const refresh = useCallback(async () => { const r = await api('/me'); setMe(r.ok ? r.data : null); }, []);
  useEffect(() => { refresh(); api('/config').then((r) => setCfg(r.data)); }, [refresh]);

  const q = new URLSearchParams(window.location.search); const rt = q.get('reset'), vt = q.get('verify');
  let body: React.ReactNode;
  if (rt || vt) body = <TokenScreen kind={rt ? 'reset' : 'verify'} token={(rt || vt) as string} />;
  else if (me === undefined || !cfg) body = <p className="note">Waking the rabbit…</p>;
  else if (me === null) body = <Auth onDone={refresh} send={send} />;
  else if (!me.user.onboarded) body = <Quiz cfg={cfg} onDone={refresh} send={send} />;
  else body = <Main me={me} cfg={cfg} refresh={refresh} send={send} />;
  return <><main>{body}</main><div className="dock" aria-hidden="true" /><Mascot state={mascot} /></>;
}

function TokenScreen({ kind, token }: { kind: 'reset' | 'verify'; token: string }) {
  const [pw, setPw] = useState(''); const [msg, setMsg] = useState(''); const [done, setDone] = useState(false);
  useEffect(() => { window.history.replaceState({}, '', '/'); }, []);
  useEffect(() => { if (kind === 'verify') api('/email/verify', { token }).then((r) => { setMsg(r.ok ? 'Your email is verified. Thank you!' : r.data.error); setDone(r.ok); }); }, [kind, token]);
  async function reset(e: React.FormEvent) { e.preventDefault(); const r = await api('/password/reset', { token, password: pw }); setMsg(r.ok ? 'Password changed. You are logged out everywhere; log in with the new one.' : r.data.error); setDone(r.ok); }
  return <div className="card"><h1>{kind === 'reset' ? 'Choose a new password' : 'Email check'}</h1>
    {kind === 'reset' && !done && <form onSubmit={reset}><input type="password" aria-label="New password" placeholder="New password (8+ characters)" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /><p><button type="submit">Save new password</button></p></form>}
    {msg && <p role="status">{msg}</p>}
    <p className="note"><a href="/">Back to the app</a></p></div>;
}

function Auth({ onDone, send }: { onDone: () => void; send: Send }) {
  const [mode, setMode] = useState<'signup' | 'login' | 'forgot'>('signup'); const [note, setNote] = useState('');
  const [f, setF] = useState({ name: '', email: '', password: '' }); const [err, setErr] = useState('');
  useEffect(() => { send('onboarding_start'); }, [send]);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setNote('');
    if (mode === 'forgot') { const fr = await api('/password/forgot', { email: f.email }); setNote(fr.data.message || fr.data.error || 'Please try again.'); return; }
    const r = await api(mode === 'signup' ? '/signup' : '/login', { ...f, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (r.ok) onDone(); else setErr(r.data.error || 'Something went sideways. Try again?');
  }
  return <form onSubmit={go}>
    <h1>go down this rabbit hole</h1>
    <div className="bubble">{mode === 'signup' ? "Hi, hi! Come on in and make yourself at home. Let's get you a cozy little account first." : 'Welcome back! The kettle is on.'}</div>
    {mode === 'signup' && <input type="text" placeholder="What should I call you?" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Name" />}
    <input type="email" placeholder="Email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email" />
    {mode !== 'forgot' && <input type="password" placeholder="Password (8+ characters)" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-label="Password" />}
    {note && <p role="status">{note}</p>}
    {err && <p className="err" role="alert">{err}</p>}
    <p className="note">Preview build: there is no email verification or password reset yet, so please don't reuse an important password.</p>
    <p><button type="submit">{mode === 'signup' ? 'Start my 3 free days' : mode === 'forgot' ? 'Send reset link' : 'Log in'}</button></p>
    <p className="note"><a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'signup' ? 'login' : 'signup'); }}>{mode === 'signup' ? 'I already have an account' : 'I need an account'}</a>{mode === 'login' && <> · <a href="#" onClick={(e) => { e.preventDefault(); setMode('forgot'); }}>Forgot password?</a></>}</p>
  </form>;
}

function Quiz({ cfg, onDone, send }: { cfg: Cfg; onDone: () => void; send: Send }) {
  const [tags, setTags] = useState<string[]>([]); const [fmts, setFmts] = useState<string[]>([]); const [len, setLen] = useState('short'); const [err, setErr] = useState('');
  useEffect(() => { send('quiz_begin'); }, [send]);
  const tog = (a: string[], s: (x: string[]) => void, v: string) => s(a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
  return <div>
    <h1>Let's get to know you</h1>
    <div className="bubble">Just three quick questions, one time only. There are no wrong answers, I promise. I'll keep it cozy.</div>
    <h2>What makes you curious?</h2>
    <div className="chips">{cfg.topics.map((t) => <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)} onClick={() => tog(tags, setTags, t)}>{t}</button>)}</div>
    <h2>How do you like a story told?</h2>
    <div className="chips">{cfg.formats.map((f) => <button key={f.id} type="button" className="chip" aria-pressed={fmts.includes(f.id)} onClick={() => tog(fmts, setFmts, f.id)}>{f.label}</button>)}</div>
    <h2>How long should a rabbit hole be?</h2>
    <div className="chips">{[['short', 'A quick nibble'], ['medium', 'A good chew']].map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={len === v} onClick={() => setLen(v)}>{l}</button>)}</div>
    {err && <p className="err">{err}</p>}
    <p><button onClick={async () => { const r = await api('/quiz', { interestTags: tags, formats: fmts, length: len }); if (r.ok) onDone(); else setErr(r.data.error); }}>All set!</button></p>
  </div>;
}

function Main({ me, cfg, refresh, send }: { me: Me; cfg: Cfg; refresh: () => void; send: Send }) {
  const [tab, setTab] = useState<'today' | 'finder' | 'streaks' | 'plan'>('today');
  const go = (t: typeof tab) => { setTab(t); send(t === 'finder' ? 'tab_change_finder' : 'tab_change_other'); };
  const names: [typeof tab, string][] = [['today', 'Today'], ['finder', 'Connect'], ['streaks', 'Streaks'], ['plan', 'Plan']];
  return <div>
    <nav className="tabs" aria-label="Sections">{names.map(([k, l]) => <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}><Icon k={k} />{l}</button>)}</nav>
    <div hidden={tab !== 'today'}><Today me={me} refresh={refresh} send={send} /></div>
    {tab === 'finder' && <Finder me={me} send={send} />}
    {tab === 'streaks' && <Streaks me={me} />}
    {tab === 'plan' && <Plan me={me} cfg={cfg} />}
  </div>;
}

function Today({ me, refresh, send }: { me: Me; refresh: () => void; send: Send }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [reading, setReading] = useState(false); const [res, setRes] = useState<any>(null);
  const t0 = useRef(0); const [extra, setExtra] = useState<any>(null); const [bmsg, setBmsg] = useState('');
  async function openBonus() { const r = await api('/bonus/redeem', {}); if (r.ok) { setExtra(r.data.hole); t0.current = Date.now(); refresh(); window.scrollTo({ top: 0 }); } else setBmsg(r.data.message || r.data.error); }
  async function closeBonus() { await api('/read', { holeId: extra.id, seconds: Math.round((Date.now() - t0.current) / 1000), completed: true }); setExtra(null); refresh(); }
  useEffect(() => { api('/today').then((r) => (r.ok ? setD(r.data) : setErr(r.data.message || r.data.error))); }, []);
  const start = () => { t0.current = Date.now(); setReading(true); send('read_start'); window.scrollTo({ top: 0 }); };
  async function finish() {
    const seconds = Math.round((Date.now() - t0.current) / 1000);
    const r = await api('/read', { holeId: d.hole.id, seconds, completed: true });
    setReading(false); setRes(r.data); send('read_finish'); refresh();
  }
  if (err) return <div className="card"><h2>Hold on</h2><p>{err}</p><p className="note">Plans start on the Plan tab. Payments are not switched on yet.</p></div>;
  if (!d) return <p className="note">Digging up today's rabbit hole…</p>;
  const h = d.hole;
  if (extra) return <article className="card"><p className="note">Bonus rabbit hole</p><Story hole={extra} /><p><button onClick={closeBonus}>I'm done reading</button></p><p className="note">{extra.sourceCheck === 'manual' ? `Sample story. Compared by hand against the source text on ${extra.checked.date} (one source, not independent verification). Source: ` : 'Sample story. Its sources have not been checked by the app yet: '}{extra.sources.map((x: any, i: number) => <span key={i}><a href={x.url} target="_blank" rel="noreferrer">{x.label}</a>{i < extra.sources.length - 1 ? ', ' : ''}</span>)}</p></article>;
  if (res || d.readToday) return <div className="card">
    <h2>That's today's rabbit hole</h2>
    <p>{res?.alreadyCounted ? 'Already counted for today.' : res ? `Streak: ${res.streak} day${res.streak === 1 ? '' : 's'}.` : `You've already read today. Streak: ${me.streak.current}.`}</p>
    {res?.freezesUsed > 0 && <p className="note">A streak freeze covered {res.freezesUsed} missed day{res.freezesUsed > 1 ? 's' : ''}.</p>}
    {res?.reset && <p className="note">A fresh start today. Streaks are meant to be cozy, not scary.</p>}
    {res?.bonusEarned && <p className="ok">You earned a bonus rabbit hole!</p>}
    {me.streak.bonusHoles > 0 && <p><button onClick={openBonus}>Open a bonus rabbit hole ({me.streak.bonusHoles})</button></p>}
    {bmsg && <p className="note" role="status">{bmsg}</p>}
    <p className="note">That's all for today. Nothing else to scroll. See you tomorrow!</p>
  </div>;
  return <div>
    <div className="card hero">
      <p className="eyebrow">Today's rabbit hole</p><h1>{h.title}</h1><p>{h.hook}</p><p className="note">{h.why}</p>
      {!reading && <button onClick={start}>Jump in</button>}
    </div>
    {reading && <article className="card"><ReadProgress /><Story hole={h} />{h.shortened && <p className="note">Short version: some details are left out. The full version is shown when you pick "A good chew" in the quiz (changing it later is not built yet).</p>}<p><button onClick={finish}>I'm done reading</button></p>
      <p className="note">{h.sourceCheck === 'manual' ? `Sample story. Compared by hand against the source text on ${h.checked.date} (one source, not independent verification). Source: ` : 'Sample story. Its sources have not been checked by the app yet: '}{h.sources.map((s: any, i: number) => <span key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>{i < h.sources.length - 1 ? ', ' : ''}</span>)}</p></article>}
  </div>;
}

function Icon({ k }: { k: string }) {
  const d: Record<string, string> = {
    today: 'M4 18c0-5 3-9 8-9s8 4 8 9M12 9V4M8 6l4-2 4 2',
    finder: 'M9 12a3 3 0 0 1 3-3h3M15 12a3 3 0 0 1-3 3H9M8 12h8',
    streaks: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
    plan: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  };
  return <svg className="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d[k]} /></svg>;
}

function ReadProgress() {
  const [p, setP] = useState(0);
  useEffect(() => { const f = () => { const m = document.documentElement.scrollHeight - window.innerHeight; setP(m > 0 ? Math.min(100, Math.round((window.scrollY / m) * 100)) : 100); }; f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, []);
  return <div className="progress" role="progressbar" aria-label="Reading progress" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}><i style={{ width: p + '%' }} /></div>;
}

function Story({ hole }: { hole: any }) {
  const paras: string[] = hole.story || [];
  const beats: { q: string; a: string }[] = hole.beats || [];
  return <>
    <div className="story">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
    {hole.format !== 'narrative' && beats.length > 0 && <div className="recap"><h3>{hole.format === 'steps' ? 'The short version, step by step' : 'The short version, as questions'}</h3>
      {hole.format === 'qa' ? beats.map((b, i) => <div className="beat" key={i}><h3 style={{ color: 'var(--ink)' }}>{b.q}</h3><p>{b.a}</p></div>)
        : <ol className="steps">{beats.map((b, i) => <li key={i}><strong>{b.q}</strong> {b.a}</li>)}</ol>}</div>}
  </>;
}

function Finder({ me, send }: { me: Me; send: Send }) {
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [found, setFound] = useState<any>(null);
  const q = me.access.finderQuota;
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(''); setFound(null); send('tab_change_finder');
    const r = await api('/finder', { a, b }); setBusy(false); if (r.data.ok) { setFound(r.data); send('finder_result'); } else { setMsg(r.data.message || r.data.error || ''); send('tab_change_other'); }
  }
  return <form onSubmit={go}>
    <div className="card hero"><p className="eyebrow">Connection finder</p><h1>Two words. A sourced bridge.</h1>
    <p>Type two things. The rabbit looks for a topic that both Wikipedia pages mention and shows you the sentences. Some pairs have no bridge, and then it says so.</p>
    <div className="pair"><input type="text" placeholder="moon" value={a} onChange={(e) => setA(e.target.value)} aria-label="First word" /><span aria-hidden="true">↔</span>
    <input type="text" placeholder="cheese" value={b} onChange={(e) => setB(e.target.value)} aria-label="Second word" /></div>
    <div className="examples" aria-label="Example pairs">{[['moon', 'cheese'], ['honey', 'Venus'], ['wombat', 'cube']].map(([x, y]) => <button type="button" className="soft" key={x + y} onClick={() => { setA(x); setB(y); }}>{x} + {y}</button>)}</div></div>
    <p><button disabled={busy || !a.trim() || !b.trim()}>{busy ? 'Thinking…' : 'Find the link'}</button></p>
    {msg && <div className="bubble" role="status">{msg}</div>}
    {found && <div className="card hero" role="status"><p className="eyebrow">A sourced bridge</p>
      <p style={{ fontSize: '1.1rem' }}><strong>{found.a.title}</strong> and <strong>{found.b.title}</strong> both point to <strong>{found.bridge.via}</strong>.</p>
      <p className="note">Sourced: these sentences are copied from the two Wikipedia pages, and each mentions "{found.bridge.via}".</p>
      <blockquote style={{ borderLeft: '3px solid var(--amber)', margin: '10px 0', padding: '2px 12px' }}>“{found.bridge.sentA}”<br /><a href={found.a.url} target="_blank" rel="noreferrer">{found.a.title} (Wikipedia)</a></blockquote>
      <blockquote style={{ borderLeft: '3px solid var(--amber)', margin: '10px 0', padding: '2px 12px' }}>“{found.bridge.sentB}”<br /><a href={found.b.url} target="_blank" rel="noreferrer">{found.b.title} (Wikipedia)</a></blockquote>
      {found.inference && <p><span className="tag">Rabbit's guess, not sourced</span> {found.inference}</p>}
      {found.alternatives?.length > 0 && <p className="note">Other shared topics: {found.alternatives.join(', ')}.</p>}
      <p className="note">Both pages mentioning a topic is a lead, not proof the two things are closely related.</p></div>}
    <div className="card"><h3>How this will work</h3><ul className="ticks"><li>Every link comes with its sources, so you can check it.</li><li>If the rabbit can't find a true link, it says so instead of making one up.</li><li>The app finds a topic both Wikipedia pages mention and shows the sentences from each. Anything the rabbit adds is labelled as its own guess.</li><li>Tries depend on your plan.</li></ul></div>
    {q && <p className="note">Your plan: {q.limit} {q.limit === 1 ? 'try' : 'tries'} per {q.period}.</p>}
  </form>;
}

function Streaks({ me }: { me: Me }) {
  const [board, setBoard] = useState<any[]>([]); const [code, setCode] = useState(''); const [join, setJoin] = useState(''); const [msg, setMsg] = useState('');
  const load = () => api('/leaderboard').then((r) => setBoard(r.data.board || []));
  useEffect(() => { load(); }, []);
  return <div>
    <div className="card hero"><p className="eyebrow">Current streak</p><div className="streak"><svg className="flame" width="40" height="40" viewBox="0 0 24 24" fill="#ffb347" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-2.500 1.200-4 2.500-5 .2 2 1 3 2 3 0-3-1.500-5 1.500-10z" /></svg> {me.streak.current} <span className="note">day{me.streak.current === 1 ? "" : "s"}</span></div>
      <div className="pips" aria-label={`Progress toward a 7 day streak: ${Math.min(me.streak.current, 7)} of 7`}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <div key={n} className={'pip' + (me.streak.current >= n ? ' on' : '')}>{n}</div>)}</div>
      <div className="stat"><div><b>{me.streak.longest}</b>Best</div><div><b>{me.streak.freezesLeft}</b>Freezes</div><div><b>{me.streak.bonusHoles}</b>Bonus holes</div></div>
      <p className="note">You don't have to read every day. A freeze covers a missed day.</p></div>
    <div className="card"><h2>Friends</h2>
      <ol className="board" aria-label="Friends streak leaderboard">{board.map((r, i) => <li key={i} className={'row' + (r.me ? ' me' : '')}><span className="rank">{i + 1}</span><span className="nm">{r.name}{r.me ? ' (you)' : ''}</span><span>{r.streak} day{r.streak === 1 ? '' : 's'}</span></li>)}</ol>
      <p><button className="soft" onClick={async () => { const r = await api('/invite', {}); setCode(r.data.code); }}>Get an invite code</button></p>
      {code && <p role="status">Share this code: <strong>{code}</strong></p>}
      <input type="text" placeholder="Have a friend's code?" value={join} onChange={(e) => setJoin(e.target.value)} aria-label="Friend code" />
      <button className="soft" onClick={async () => { const r = await api('/join', { code: join }); setMsg(r.ok ? 'Friend added!' : r.data.error); if (r.ok) load(); }}>Add friend</button>
      {msg && <p className="note" role="status">{msg}</p>}</div>
  </div>;
}

function Plan({ me, cfg }: { me: Me; cfg: Cfg }) {
  const p = cfg.plans; const fz = (n: number | null) => (n === null ? 'to be decided' : n);
  const fq = (x: any) => `${x.limit}/${x.period}`; const [msg, setMsg] = useState('');
  async function buy(plan: string) { const r = await api('/checkout', { plan }); if (r.ok && r.data.url) window.location.href = r.data.url; else setMsg(r.data.message || 'Could not start checkout.'); }
  const per = (x: any) => (x.period === 'day' ? 'a day' : x.period === 'week' ? 'a week' : x.period);
  return <div>
    <div className="card hero"><p className="eyebrow">Your plan</p><h1>{me.access.plan === 'trial' ? 'Free 3-day trial' : me.access.plan}</h1>
      {me.access.plan === 'trial' && <p className="note">Trial ends {new Date(me.access.trialEndsAt).toLocaleString()}</p>}
      <p className="note">One rabbit hole a day. No endless feed, ever.</p></div>
    <div className="plans">{([['plan3', 'Little burrow', '$3'], ['plan5', 'Deep warren', '$5']] as const).map(([k, l, pr]) => <div className={'card plan' + (k === 'plan5' ? ' pop' : '')} key={k}>
      <h2>{l}</h2><div className="price">{pr}<small> / {p[k].billing ?? 'billing period to be decided'}</small></div>
      <ul className="ticks"><li>A personalised rabbit hole every day</li><li>Connection finder: {p[k].connection_finder.limit} {p[k].connection_finder.limit === 1 ? 'try' : 'tries'} {per(p[k].connection_finder)}</li><li>Streak freezes: {fz(p[k].streak_freezes)}</li></ul>
      {cfg.payments === 'test_mode' ? <button onClick={() => buy(k)}>Start {l} (test mode, no real charge)</button> : <button disabled>Payments not switched on yet</button>}</div>)}</div>
    {msg && <p className="note" role="status">{msg}</p>}
    <p className="note">Prices are in USD. Payments are not live; nothing can be charged in this preview.</p>
  </div>;
}
