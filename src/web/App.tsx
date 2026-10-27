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

  let body: React.ReactNode;
  if (me === undefined || !cfg) body = <p className="note">Waking the rabbit…</p>;
  else if (me === null) body = <Auth onDone={refresh} send={send} />;
  else if (!me.user.onboarded) body = <Quiz cfg={cfg} onDone={refresh} send={send} />;
  else body = <Main me={me} cfg={cfg} refresh={refresh} send={send} />;
  return <><main>{body}</main><div className="dock" aria-hidden="true" /><Mascot state={mascot} /></>;
}

function Auth({ onDone, send }: { onDone: () => void; send: Send }) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [f, setF] = useState({ name: '', email: '', password: '' }); const [err, setErr] = useState('');
  useEffect(() => { send('onboarding_start'); }, [send]);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    const r = await api(mode === 'signup' ? '/signup' : '/login', { ...f, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (r.ok) onDone(); else setErr(r.data.error || 'Something went sideways. Try again?');
  }
  return <form onSubmit={go}>
    <h1>go down this rabbit hole</h1>
    <div className="bubble">{mode === 'signup' ? "Hi, hi! Come on in and make yourself at home. Let's get you a cozy little account first." : 'Welcome back! The kettle is on.'}</div>
    {mode === 'signup' && <input type="text" placeholder="What should I call you?" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Name" />}
    <input type="email" placeholder="Email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email" />
    <input type="password" placeholder="Password (8+ characters)" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-label="Password" />
    {err && <p className="err" role="alert">{err}</p>}
    <p className="note">Preview build: there is no email verification or password reset yet, so please don't reuse an important password.</p>
    <p><button type="submit">{mode === 'signup' ? 'Start my 3 free days' : 'Log in'}</button></p>
    <p className="note"><a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'signup' ? 'login' : 'signup'); }}>{mode === 'signup' ? 'I already have an account' : 'I need an account'}</a></p>
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
    <nav className="tabs" aria-label="Sections">{names.map(([k, l]) => <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>{l}</button>)}</nav>
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
    <div className="card">
      <p className="note">Today's rabbit hole</p><h1>{h.title}</h1><p>{h.hook}</p><p className="note">{h.why}</p>
      {!reading && <button onClick={start}>Jump in</button>}
    </div>
    {reading && <article className="card"><Story hole={h} />{h.shortened && <p className="note">Short version: some details are left out. The full version is shown when you pick "A good chew" in the quiz (changing it later is not built yet).</p>}<p><button onClick={finish}>I'm done reading</button></p>
      <p className="note">{h.sourceCheck === 'manual' ? `Sample story. Compared by hand against the source text on ${h.checked.date} (one source, not independent verification). Source: ` : 'Sample story. Its sources have not been checked by the app yet: '}{h.sources.map((s: any, i: number) => <span key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>{i < h.sources.length - 1 ? ', ' : ''}</span>)}</p></article>}
  </div>;
}

function Story({ hole }: { hole: any }) {
  const beats: { q: string; a: string }[] = hole.beats;
  if (hole.format === 'qa') return <>{beats.map((b, i) => <div className="beat" key={i}><h3>{b.q}</h3><p>{b.a}</p></div>)}</>;
  if (hole.format === 'steps') return <ol className="steps">{beats.map((b, i) => <li key={i}><strong>{b.q}</strong> {b.a}</li>)}</ol>;
  return <>{beats.map((b, i) => <p key={i}>{b.a}</p>)}</>;
}

function Finder({ me, send }: { me: Me; send: Send }) {
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const q = me.access.finderQuota;
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(''); send('tab_change_finder');
    const r = await api('/finder', { a, b }); setBusy(false); setMsg(r.data.message || r.data.error || ''); send('tab_change_other');
  }
  return <form onSubmit={go}>
    <h1>Connection finder</h1>
    <p>Type two random things. I'll look for a true, surprising link you can drop into conversation.</p>
    <input type="text" placeholder="moon" value={a} onChange={(e) => setA(e.target.value)} aria-label="First word" />
    <input type="text" placeholder="cheese" value={b} onChange={(e) => setB(e.target.value)} aria-label="Second word" />
    <p><button disabled={busy || !a.trim() || !b.trim()}>{busy ? 'Thinking…' : 'Find the link'}</button></p>
    {msg && <div className="bubble">{msg}</div>}
    {q && <p className="note">Your plan: {q.limit} {q.limit === 1 ? 'try' : 'tries'} per {q.period}.</p>}
  </form>;
}

function Streaks({ me }: { me: Me }) {
  const [board, setBoard] = useState<any[]>([]); const [code, setCode] = useState(''); const [join, setJoin] = useState(''); const [msg, setMsg] = useState('');
  const load = () => api('/leaderboard').then((r) => setBoard(r.data.board || []));
  useEffect(() => { load(); }, []);
  return <div>
    <div className="card"><p className="note">Current streak</p><div className="streak">{me.streak.current} <span className="note">day{me.streak.current === 1 ? "" : "s"}</span></div>
      <p>Best: {me.streak.longest} · Freezes: {me.streak.freezesLeft} · Bonus holes: {me.streak.bonusHoles}</p>
      <p className="note">You don't have to read every day. A freeze covers a missed day.</p></div>
    <div className="card"><h2>Friends</h2>
      <ol className="board" aria-label="Friends streak leaderboard">{board.map((r, i) => <li key={i} className={'row' + (r.me ? ' me' : '')}><span>{r.name}{r.me ? ' (you)' : ''}</span><span>{r.streak} day{r.streak === 1 ? '' : 's'}</span></li>)}</ol>
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
  return <div>
    <h1>Your plan</h1>
    <div className="card"><p>Now: <strong>{me.access.plan === 'trial' ? 'Free trial' : me.access.plan}</strong>{me.access.plan === 'trial' && <> · ends {new Date(me.access.trialEndsAt).toLocaleString()}</>}</p></div>
    {([['plan3', '$3 plan'], ['plan5', '$5 plan']] as const).map(([k, l]) => <div className="card" key={k}><h2>{l}</h2>
      <p>Rabbit holes · Connection finder {fq(p[k].connection_finder)} · Streak freezes: {fz(p[k].streak_freezes)}</p>
      <p className="note">Billing period: {p[k].billing ?? 'to be decided'}</p>{cfg.payments === 'test_mode' ? <button onClick={() => buy(k)}>Start {l} (test mode, no real charge)</button> : <button disabled>Payments not switched on yet</button>}</div>)}
    {msg && <p className="note" role="status">{msg}</p>}
  </div>;
}
