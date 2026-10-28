import { TagGlyph, Plate, TrailPath, MilestoneLine, InterestBars, BridgeViz, Emblem, NextMark, WeekRow, MonthCalendar, ForestScene, SkyLayer, LakeScene } from './visuals';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { Mascot, useMascot } from './Mascot';
import type { MascotEvent } from '../shared/mascot';

type Me = { user: { email: string; name: string | null; onboarded: boolean }; access: { plan: string; rabbitHoles: boolean; finderQuota: { period: string; limit: number } | null; trialEndsAt: string }; streak: { current: number; longest: number; freezesLeft: number; bonusHoles: number; readToday: boolean }; prefs: any };
type Cfg = { weather?: boolean; topics: string[]; formats: { id: string; label: string }[]; plans: any; payments?: string; emailRecovery?: boolean; whyRead?: { id: string; label: string }[]; countries?: { code: string; name: string }[]; countriesWithStories?: string[] };
type Send = (e: MascotEvent) => void;
// Move keyboard and screen-reader focus to the page heading when the view changes, so the next Tab starts at the top of the new content.
function useFocusHeading(dep: unknown, skipFirst = true) {
  const first = useRef(true);
  useEffect(() => { if (first.current && skipFirst) { first.current = false; return; } first.current = false; const h = document.querySelector('main h1') as HTMLElement | null; if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }, [dep]); // eslint-disable-line
}
type Tab = 'explore' | 'connections' | 'trail' | 'you';

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [mascot, send] = useMascot(); const [redo, setRedo] = useState(false); const [stage, setStage] = useState<'welcome' | 'auth'>('welcome'); const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const loadWeather = useCallback(async () => { const r = await api('/weather'); document.documentElement.dataset.weather = r.ok && r.data.condition ? r.data.condition : ''; }, []);
  const refresh = useCallback(async () => { const r = await api('/me'); setMe(r.ok ? r.data : null); }, []);
  useEffect(() => { if (!me || !cfg?.weather) return; loadWeather(); const t = window.setInterval(loadWeather, 30 * 60 * 1000); window.addEventListener('city-changed', loadWeather); return () => { window.clearInterval(t); window.removeEventListener('city-changed', loadWeather); }; }, [!!me, cfg?.weather]);
  useEffect(() => { refresh(); api('/config').then((r) => setCfg(r.data)); }, [refresh]);

  const q = new URLSearchParams(window.location.search); const rt = q.get('reset'), vt = q.get('verify');
  let body: React.ReactNode; let nav = false;
  if (rt || vt) body = <TokenScreen kind={rt ? 'reset' : 'verify'} token={(rt || vt) as string} />;
  else if (me === undefined || !cfg) body = <p className="note" role="status">Waking the rabbit…</p>;
  else if (me === null) body = stage === 'welcome' ? <Welcome send={send} onStart={() => { setAuthMode('signup'); setStage('auth'); }} onLogin={() => { setAuthMode('login'); setStage('auth'); }} /> : <Auth initial={authMode} onDone={refresh} send={send} recovery={!!cfg.emailRecovery} onBack={() => setStage('welcome')} />;
  else if (!me.user.onboarded || redo) body = <Quiz cfg={cfg} me={me} redo={redo} onDone={() => { setRedo(false); refresh(); }} onCancel={redo ? () => setRedo(false) : undefined} send={send} />;
  else { nav = true; body = <Main me={me} cfg={cfg} refresh={refresh} send={send} onRedo={() => setRedo(true)} />; }
  return <div className={nav ? 'shell has-nav' : 'shell'}><SkyLayer />{body}<div className="dock" aria-hidden="true" /><Mascot state={mascot} /></div>;
}

function Welcome({ onStart, onLogin, send }: { onStart: () => void; onLogin: () => void; send: Send }) {
  useEffect(() => { send('onboarding_start'); }, [send]);
  return <main className="welcome">
    <div className="hero"><LakeScene pose="read" hero /></div>
    <p className="kicker">godownthisrabbithole</p>
    <h1 className="display">Curiosity looks good on you.</h1>
    <p className="deck">Leave the scroll behind. Follow something interesting.</p>
    <p><button type="button" className="go" onClick={onStart}>Let's wander</button></p>
    <p className="note"><a href="#" onClick={(e) => { e.preventDefault(); onLogin(); }}>I already have an account</a></p>
    <p className="fine">One rabbit hole a day. No endless feed. Free for 3 days.</p>
  </main>;
}

function TokenScreen({ kind, token }: { kind: 'reset' | 'verify'; token: string }) {
  const [pw, setPw] = useState(''); const [msg, setMsg] = useState(''); const [done, setDone] = useState(false);
  useEffect(() => { window.history.replaceState({}, '', '/'); }, []);
  useEffect(() => { if (kind === 'verify') api('/email/verify', { token }).then((r) => { setMsg(r.ok ? 'Your email is verified. Thank you!' : r.data.error); setDone(r.ok); }); }, [kind, token]);
  async function reset(e: React.FormEvent) { e.preventDefault(); const r = await api('/password/reset', { token, password: pw }); setMsg(r.ok ? 'Password changed. You are logged out everywhere; log in with the new one.' : r.data.error); setDone(r.ok); }
  return <main><h1>{kind === 'reset' ? 'Choose a new password' : 'Email check'}</h1>
    {kind === 'reset' && !done && <form onSubmit={reset}><input type="password" aria-label="New password" placeholder="New password (8+ characters)" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /><p><button type="submit">Save new password</button></p></form>}
    {msg && <p role="status">{msg}</p>}
    <p className="note"><a href="/">Back to the app</a></p></main>;
}

function Auth({ onDone, send, recovery, initial, onBack }: { onDone: () => void; send: Send; recovery: boolean; initial: 'signup' | 'login'; onBack: () => void }) {
  const [mode, setMode] = useState<'signup' | 'login' | 'forgot'>(initial); const [note, setNote] = useState('');
  const [f, setF] = useState({ name: '', email: '', password: '' }); const [err, setErr] = useState('');
  useEffect(() => { send('onboarding_start'); }, [send]);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setNote('');
    if (mode === 'forgot') { const fr = await api('/password/forgot', { email: f.email }); setNote(fr.data.message || fr.data.error || 'Please try again.'); return; }
    const r = await api(mode === 'signup' ? '/signup' : '/login', { ...f, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (r.ok) onDone(); else setErr(r.data.error || 'Something went sideways. Try again?');
  }
  return <main><form onSubmit={go} className="auth">
    <p className="kicker"><a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>back</a></p>
    <h1>{mode === 'signup' ? 'First, a little burrow of your own.' : mode === 'forgot' ? 'Lost the way back?' : 'Welcome back. The kettle is on.'}</h1>
    {mode === 'signup' && <label>What should I call you?<input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="given-name" /></label>}
    {!(mode === 'forgot' && !recovery) && <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>}
    {mode === 'forgot' && !recovery && <p role="status">Password reset by email isn't available yet in this preview. If you can't log in, choose "I need an account" below to start fresh with a new email or password.</p>}
    {mode !== 'forgot' && <label>Password (8+ characters)<input type="password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>}
    {note && <p role="status">{note}</p>}
    {err && <p className="err" role="alert">{err}</p>}
    <p className="note">Preview build: no email verification or password reset yet, so please don't reuse an important password.</p>
    {!(mode === 'forgot' && !recovery) && <p><button type="submit" className="go">{mode === 'signup' ? 'Start my 3 free days' : mode === 'forgot' ? 'Send reset link' : 'Log in'}</button></p>}
    <p className="note"><a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'signup' ? 'login' : 'signup'); }}>{mode === 'signup' ? 'I already have an account' : 'I need an account'}</a>{mode === 'login' && <> · <a href="#" onClick={(e) => { e.preventDefault(); setMode('forgot'); }}>Forgot password?</a></>}</p>
  </form></main>;
}

const TZ_COUNTRY: Record<string, string> = { 'Asia/Calcutta': 'IN', 'Asia/Kolkata': 'IN', 'America/New_York': 'US', 'America/Chicago': 'US', 'America/Los_Angeles': 'US', 'Europe/London': 'GB', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'America/Toronto': 'CA', 'Asia/Singapore': 'SG', 'Asia/Dubai': 'AE', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Africa/Johannesburg': 'ZA', 'America/Sao_Paulo': 'BR', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK', 'Asia/Kathmandu': 'NP', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Pacific/Auckland': 'NZ' };
function Quiz({ cfg, me, redo, onDone, onCancel, send }: { cfg: Cfg; me: Me; redo: boolean; onDone: () => void; onCancel?: () => void; send: Send }) {
  const pf = redo ? me.prefs : null;
  const guess = TZ_COUNTRY[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? '';
  const [step, setStep] = useState(0); const [country, setCountry] = useState<string>(pf ? pf.quiz?.country ?? '' : guess);
  const [tags, setTags] = useState<string[]>(pf?.interestTags ?? []); const [why, setWhy] = useState<string[]>(pf?.quiz?.why ?? []); const [fmts, setFmts] = useState<string[]>(pf?.formats ?? []); const [len, setLen] = useState<string>(pf?.length ?? 'medium'); const [curious, setCurious] = useState<string>(pf?.quiz?.curious ?? ''); const [err, setErr] = useState('');
  useEffect(() => { send('quiz_begin'); }, [send]);
  useFocusHeading(step);
  const tog = (a: string[], s: (x: string[]) => void, v: string) => s(a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
  const withStories = cfg.countriesWithStories ?? []; const total = 5;
  const next = () => { setErr(''); if (step === 1 && !tags.length) return setErr('Pick at least one so I know where to start.'); if (step === 3 && !fmts.length) return setErr('Pick at least one style.'); setStep(step + 1); };
  const finish = async (skipNote = false) => { const r = await api('/quiz', { interestTags: tags, formats: fmts, length: len, country: country || undefined, why, curious: skipNote ? '' : curious }); if (r.ok) onDone(); else setErr(r.data.error); };
  const skippable = step === 0 || step === 2 || step === 4;
  const asks = ['Where are you reading from? I can start with stories close to home.', 'What do you actually wonder about? Pick a few.', 'Why do you want a daily rabbit hole?', 'How should a story feel?', 'Last one, and you can skip it.'];
  return <main className="quiz">
    <p className="kicker">{redo ? 'Your answers' : 'Let\'s get to know you'}</p>
    <div className="steps-bar" role="progressbar" aria-label="Quiz progress" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={total}>{Array.from({ length: total }, (_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
    <h1>{asks[step]}</h1>
    <p className="mono-note">Question {step + 1} of {total}{skippable ? ' · you can skip this one' : ''}</p>
    {step === 0 && <div>
      <label className="sr">Country</label>
      <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
        <option value="">Somewhere else / skip</option>
        {(cfg.countries ?? []).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
      {!redo && guess && country === guess && <p className="note">I guessed this from your device's timezone. Change it if it's wrong.</p>}
      <p className="note">{country && withStories.includes(country) ? "There are stories written for this country, and they'll come first." : "Local stories for this country aren't written yet, so you'll get general topics for now. Your choice is saved for when they are."}</p>
    </div>}
    {step === 1 && <div>
      <div className="chips">{cfg.topics.map((t) => <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)} onClick={() => tog(tags, setTags, t)}>{t}</button>)}</div>
      <p className="note">Everyday life and money &amp; tech are about things you meet every day: your chai, your phone payments, your trains. Topics decide which story you get next.</p>
    </div>}
    {step === 2 && <div><div className="chips">{(cfg.whyRead ?? []).map((w) => <button key={w.id} type="button" className="chip" aria-pressed={why.includes(w.id)} onClick={() => tog(why, setWhy, w.id)}>{w.label}</button>)}</div><p className="note">Optional. It adds a "tell someone" line, shows sources as "check it yourself", or nudges your first stories toward everyday life. "Unwind" changes nothing yet.</p></div>}
    {step === 3 && <div>
      <h2>Shape</h2>
      <div className="chips">{cfg.formats.map((f) => <button key={f.id} type="button" className="chip" aria-pressed={fmts.includes(f.id)} onClick={() => tog(fmts, setFmts, f.id)}>{f.label}</button>)}</div>
      <p className="note">This changes how a story is laid out: a flowing narrative, questions and answers, or steps.</p>
      <h2>How long</h2>
      <div className="chips">{[['short', 'A quick nibble'], ['medium', 'A good chew']].map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={len === v} onClick={() => setLen(v)}>{l}</button>)}</div>
      <p className="note">A quick nibble shows the first two paragraphs of a story. Tone and a time budget are not asked yet, because nothing in the stories could change with them.</p>
    </div>}
    {step === 4 && <div>
      <label className="sr" htmlFor="curious">Something you have been curious about</label>
      <input id="curious" type="text" maxLength={200} placeholder="Something you've been curious about lately" value={curious} onChange={(e) => setCurious(e.target.value)} />
      <p className="note">If a word you write here appears in one of our stories, that story can come early. It is a word match only. I don't treat what you write as fact, and with only a few stories so far a match may not exist.</p>
    </div>}
    {err && <p className="err" role="alert">{err}</p>}
    <p className="row-actions">{step > 0 && <button type="button" className="ghost" onClick={() => setStep(step - 1)}>Back</button>}{step === 0 && onCancel && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
      {skippable && <button type="button" className="ghost" onClick={() => (step < total - 1 ? setStep(step + 1) : finish(true))}>Skip</button>}
      {step < total - 1 ? <button type="button" className="go" onClick={next}>Next</button> : <button type="button" className="go" onClick={() => finish()}>{redo ? 'Save my answers' : 'All set'}</button>}</p>
  </main>;
}

function Icon({ k }: { k: Tab }) {
  const p: Record<Tab, React.ReactNode> = {
    explore: <><circle cx="12" cy="12" r="8.5" /><path d="M15.500 8.500l-2 5-5 2 2-5z" /></>,
    connections: <><circle cx="6" cy="12" r="2.500" /><circle cx="18" cy="12" r="2.500" /><path d="M8.500 12h7M11 9.800c.6-1.200 1.800-1.200 2.400 0" /></>,
    trail: <><ellipse cx="8" cy="15.500" rx="2.200" ry="3" /><circle cx="6.500" cy="10" r="1" /><circle cx="9.500" cy="9.500" r="1" /><ellipse cx="16" cy="9" rx="2.200" ry="3" /><circle cx="14.500" cy="3.600" r="1" /><circle cx="17.500" cy="3.600" r="1" /></>,
    you: <><circle cx="12" cy="8.500" r="3.500" /><path d="M5 20c.8-4 3.500-6 7-6s6.200 2 7 6" /></>,
  };
  return <svg className="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[k]}</svg>;
}

function Paws({ n, of = 7 }: { n: number; of?: number }) {
  return <div className="paws" role="img" aria-label={`${Math.min(n, of)} of ${of} footprints on this trail`}>{Array.from({ length: of }, (_, i) => <svg key={i} className={i < n ? 'on' : ''} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16" rx="5" ry="4.200" /><circle cx="6" cy="10.500" r="2" /><circle cx="10" cy="7" r="2" /><circle cx="14.500" cy="7" r="2" /><circle cx="18.500" cy="10.500" r="2" /></svg>)}</div>;
}

function Main({ me, cfg, refresh, send, onRedo }: { me: Me; cfg: Cfg; refresh: () => void; send: Send; onRedo: () => void }) {
  const [tab, setTab] = useState<Tab>('explore'); const [open, setOpen] = useState<string | null>(null);
  const go = (t: Tab) => { setTab(t); setOpen(null); send(t === 'connections' ? 'tab_change_finder' : 'tab_change_other'); window.scrollTo({ top: 0 }); };
  useFocusHeading(tab + '|' + (open ?? ''));
  const names: [Tab, string][] = [['explore', 'Explore'], ['connections', 'Connections'], ['trail', 'Trail'], ['you', 'You']];
  return <>
    <nav className="nav" aria-label="Sections"><p className="brand" aria-hidden="true">go down this<br />rabbit hole</p>{names.map(([k, l]) => <button key={k} type="button" aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}><Icon k={k} /><span>{l}</span></button>)}</nav>
    <main>
      {open ? <StoryView topicId={open} onBack={() => setOpen(null)} />
        : <>
          <div hidden={tab !== 'explore'}><Explore me={me} refresh={refresh} send={send} goTab={go} /></div>
          {tab === 'connections' && <Finder me={me} send={send} />}
          {tab === 'trail' && <Trail me={me} onOpen={setOpen} />}
          {tab === 'you' && <You me={me} cfg={cfg} onRedo={onRedo} onOpen={setOpen} />}
        </>}
    </main>
  </>;
}

const SAVE_LABEL = (s: boolean) => (s ? 'Saved' : 'Save for later');
function SaveButton({ topicId, initial }: { topicId: string; initial: boolean }) {
  const [saved, setSaved] = useState(initial); const [busy, setBusy] = useState(false);
  async function toggle() { setBusy(true); const r = await api('/save', { topicId, saved: !saved }); setBusy(false); if (r.ok) setSaved(!saved); }
  return <button type="button" className="ghost" aria-pressed={saved} disabled={busy} onClick={toggle}>{SAVE_LABEL(saved)}</button>;
}

function Peek() {
  return <svg className="peek" width="64" height="40" viewBox="0 0 64 40" aria-hidden="true"><path d="M2 40Q32 14 62 40Z" fill="var(--burrow)" /><g fill="#fdfdf8" stroke="var(--ctl)" strokeWidth=".6"><ellipse cx="26" cy="14" rx="3.200" ry="9" /><ellipse cx="37" cy="14" rx="3.200" ry="9" /></g><g fill="var(--coral)"><ellipse cx="26" cy="15" rx="1.200" ry="6" /><ellipse cx="37" cy="15" rx="1.200" ry="6" /></g><ellipse cx="31.500" cy="30" rx="9" ry="6" fill="#fdfdf8" /><circle cx="28.500" cy="29" r="1" fill="#3b2a20" /><circle cx="34.500" cy="29" r="1" fill="#3b2a20" /></svg>;
}

function Explore({ me, refresh, send, goTab }: { me: Me; refresh: () => void; send: Send; goTab: (t: Tab) => void }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState<{ status: number; msg: string } | null>(null); const [reading, setReading] = useState(false); const [res, setRes] = useState<any>(null); const [again, setAgain] = useState(false);
  useFocusHeading(String(reading) + String(!!res));
  const t0 = useRef(0); const [extra, setExtra] = useState<any>(null); const [bmsg, setBmsg] = useState(''); const [savedN, setSavedN] = useState<number | null>(null);
  async function openBonus() { const r = await api('/bonus/redeem', {}); if (r.ok) { setExtra(r.data.hole); t0.current = Date.now(); refresh(); window.scrollTo({ top: 0 }); } else setBmsg(r.data.message || r.data.error); }
  async function closeBonus() { await api('/read', { holeId: extra.id, seconds: Math.round((Date.now() - t0.current) / 1000), completed: true }); setExtra(null); refresh(); }
  const load = useCallback(() => { setErr(null); api('/today').then((r) => (r.ok ? setD(r.data) : setErr({ status: r.status, msg: r.data.message || r.data.error || 'Something went sideways.' }))); }, []);
  useEffect(() => { load(); api('/saved').then((r) => r.ok && setSavedN(r.data.items.length)); }, [load]);
  const start = () => { t0.current = Date.now(); setReading(true); send('read_start'); window.scrollTo({ top: 0 }); };
  async function finish() {
    const seconds = Math.round((Date.now() - t0.current) / 1000);
    const r = await api('/read', { holeId: d.hole.id, seconds, completed: true });
    setReading(false); setRes(r.data); send('read_finish'); refresh(); window.scrollTo({ top: 0 });
  }
  if (err) return <section>
    {err.status === 402 ? <><p className="kicker">Your trial</p><h1>The 3 free days are up.</h1><p className="deck">Your streak and your saved stories are still here. Pick a plan whenever you like. No pressure.</p><p><button type="button" className="go" onClick={() => goTab('you')}>See plans</button></p><p className="note">Payments are not switched on yet in this preview.</p></>
      : <><h1>The rabbit hit a snag.</h1><p className="deck">{err.msg}</p><p><button type="button" className="go" onClick={load}>Try again</button></p></>}
  </section>;
  if (!d) return <p className="note" role="status">Digging up today's detour…</p>;
  const h = d.hole; const done = !!(res || d.readToday);
  if (extra) return <article className="reading"><ReadingRail /><MarginScene /><StartScene /><p className="kicker">Another trail</p><Story hole={extra} /><Sources hole={extra} /><p><button type="button" className="go" onClick={closeBonus}>I'm back up</button></p></article>;
  if (reading) return <article className="reading"><ReadProgress /><ReadingRail /><MarginScene /><StartScene /><p className="kicker mono">{h.tags.join(' · ')} · about {h.minutes} min read</p><h1 className="story-title">{h.title}</h1><Plate tags={h.tags} />
    <Story hole={h} /><Related hole={h} />
    <aside className="takeaway"><p className="kicker">Worth telling someone</p><p className="serif">{h.hook}</p></aside>
    {h.shortened && <p className="note">Short version: some details are left out. Pick "A good chew" in your answers to read the full story.</p>}
    <Sources hole={h} />
    <EndScene />
    <p className="row-actions"><SaveButton topicId={h.topicId} initial={h.saved} /><button type="button" className="go" onClick={finish}>I'm done reading</button></p>
  </article>;
  const greeting = me.user.name ? `Where should we wander today, ${me.user.name}?` : 'Where should we wander today?';
  return <div className="explore">
    <p className="greet">{greeting}</p>
    {done ? <section className="detour"><ForestScene kind="carrot" /><p className="kicker">{res?.alreadyCounted ? 'Already counted' : 'Today\'s detour, found'}</p><h1 className="story-title">Look what your curiosity uncovered.</h1>
      <p className="deck"><em>{h.title}</em> is in your trail. {res && !res.alreadyCounted ? `Streak: ${res.streak} day${res.streak === 1 ? '' : 's'}.` : `Streak: ${me.streak.current} day${me.streak.current === 1 ? '' : 's'}.`}</p>
      {res?.freezesUsed > 0 && <p className="note">A streak freeze covered {res.freezesUsed} missed day{res.freezesUsed > 1 ? 's' : ''}.</p>}
      {res?.reset && <p className="note">A fresh start today. No pressure. Curiosity isn't homework.</p>}
      {res?.bonusEarned && <p className="ok">Another trail turned up for you.</p>}
      <p className="row-actions"><button type="button" className="ghost" onClick={() => setAgain(!again)}>{again ? 'Hide the story' : 'Read it again'}</button><SaveButton topicId={h.topicId} initial={h.saved} /></p>
      <p className="note">Re-reading does not change your streak or count again.</p>
      {again && <article className="reading inline"><Story hole={h} /><Related hole={h} /><Sources hole={h} /></article>}
    </section>
      : <section className="detour"><Peek /><p className="kicker">Today's detour</p><h1 className="story-title">{h.title}</h1><p className="deck">{h.hook}</p>
        <p className="mono-note">{h.tags.join(' · ')} · about {h.minutes} min read</p>
        <p><button type="button" className="go" onClick={start}>Go down this rabbit hole</button></p>
        <Plate tags={h.tags} /><p className="note">{h.why}</p></section>}
    {!done && me.streak.current === 0 && me.streak.longest > 0 && <section className="sceneblock"><ForestScene kind="fox" /><p className="serif">A fox wandered by while you were away.</p><p className="note">The rabbit is fine, tucked in its burrow. Your trail starts fresh today. No pressure.</p></section>}
    {done && me.streak.bonusHoles > 0 && <section className="strip"><p className="kicker">Another trail</p><p>You have {me.streak.bonusHoles} extra.</p><button type="button" className="ghost" onClick={openBonus}>One tiny detour?</button>{bmsg && <p className="note" role="status">{bmsg}</p>}</section>}
    <section className="strip"><p className="kicker">Connections</p><p className="serif">Two words. One strange bridge.</p><p className="note">Try "moon" and "cheese". The rabbit looks for a link both Wikipedia pages mention. It's an early version.</p><button type="button" className="ghost" onClick={() => goTab('connections')}>Open the lab</button></section>
    <section className="strip row"><div><p className="kicker">Trail</p><Paws n={me.streak.current} /><p className="mono-note">day {me.streak.current}</p></div><div><p className="kicker">Saved</p><button type="button" className="ghost" onClick={() => goTab('you')}>{savedN === null ? 'Saved discoveries' : savedN ? `${savedN} saved` : 'Nothing saved yet'}</button></div></section>
    <p className="fine">That's all for today. Nothing else to scroll.</p><div className="lakewrap"><LakeScene pose="fish" /></div>
  </div>;
}

function Sources({ hole }: { hole: any }) {
  const s: any[] = hole.sources || [];
  return <p className="note sources">{hole.sourceCheck === 'manual' ? `Sample story. Compared by hand against the source text on ${hole.checked.date} (one source, not independent verification). Source: ` : 'Sample story. Its sources have not been checked by the app yet: '}{s.map((x, i) => <span key={i}><a href={x.url} target="_blank" rel="noreferrer">{x.label}</a>{i < s.length - 1 ? ', ' : ''}</span>)}</p>;
}

function StoryView({ topicId, onBack }: { topicId: string; onBack: () => void }) {
  const [h, setH] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { api(`/story/${topicId}`).then((r) => (r.ok ? setH(r.data.hole) : setErr(r.data.message || r.data.error))); }, [topicId]);
  return <article className="reading"><ReadingRail /><MarginScene /><StartScene /><p><button type="button" className="ghost" onClick={onBack}>Back</button></p>
    {err && <p className="err" role="alert">{err}</p>}{!h && !err && <p className="note" role="status">Finding it again…</p>}
    {h && <><p className="kicker mono">{h.tags.join(' · ')} · about {h.minutes} min read</p><h1 className="story-title">{h.title}</h1><Story hole={h} /><aside className="takeaway"><p className="kicker">Worth telling someone</p><p className="serif">{h.hook}</p></aside><Sources hole={h} /><p className="row-actions"><SaveButton topicId={h.topicId} initial={h.saved} /></p><p className="note">Re-reading does not change your streak.</p></>}
  </article>;
}

function Related({ hole }: { hole: any }) {
  const [open, setOpen] = useState<any>(null); const [msg, setMsg] = useState('');
  if (!hole.related) return null;
  async function go() { const r = await api(`/related/${hole.related.id}`); if (r.ok) setOpen(r.data.hole); else setMsg(r.data.message || r.data.error || 'Could not open it.'); }
  return <aside className="connection"><p className="kicker">One tiny detour?</p>
    <p>Wikipedia links this story to "{hole.related.title}": {hole.related.sentence}</p>
    {!open && <p><button type="button" className="ghost" onClick={go}>Read "{hole.related.title}"</button> <span className="note">Optional. It does not change tomorrow's story, your streak or what counts as read.</span></p>}
    {msg && <p className="note" role="status">{msg}</p>}
    {open && <div><h2 className="serif">{open.title}</h2><Story hole={open} /><Sources hole={open} /><p><button type="button" className="ghost" onClick={() => setOpen(null)}>Close</button></p></div>}
  </aside>;
}

function Story({ hole }: { hole: any }) {
  const paras: string[] = hole.story || [];
  const beats: { q: string; a: string }[] = hole.beats || [];
  return <>
    <div className="story">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
    {(hole.whyModes || []).includes('learn') && (hole.sources || []).length > 0 && <aside className="recap"><p className="kicker">Check it yourself</p><p>{(hole.sources as any[]).map((x, i) => <span key={i}><a href={x.url} target="_blank" rel="noreferrer">{x.label}</a>{i < hole.sources.length - 1 ? ', ' : ''}</span>)}</p></aside>}
    {hole.format !== 'narrative' && beats.length > 0 && <aside className="recap"><h2 className="serif">{hole.format === 'steps' ? 'The short version, step by step' : 'The short version, as questions'}</h2>
      {hole.format === 'qa' ? beats.map((b, i) => <div className="beat" key={i}><h3 className="serif">{b.q}</h3><p>{b.a}</p></div>)
        : <ol className="steps">{beats.map((b, i) => <li key={i}><strong>{b.q}</strong> {b.a}</li>)}</ol>}</aside>}
  </>;
}

function useReadProgress() {
  const [p, setP] = useState(0);
  useEffect(() => { const f = () => { const m = document.documentElement.scrollHeight - window.innerHeight; setP(m > 0 ? Math.min(1, window.scrollY / m) : 1); }; f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, []);
  return p;
}
function ReadProgress() {
  const p = useReadProgress();
  return <div className="progress" role="progressbar" aria-label="Reading progress" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: p * 100 + '%' }} /></div>;
}
// Reading keeps the page for the words. The rabbit's world frames it: a small pier scene at the start, a fish line along the top edge
// on narrow screens, the rabbit and a rising fish in the side margin on wide screens, and the catch at the end. Nothing sits over the text.
const ease = (p: number, from: number) => Math.max(0, Math.min(1, (p - from) / (1 - from)));
function ReadingRail() {
  const p = useReadProgress();
  return <div className="rail" aria-hidden="true"><svg className="railsvg" viewBox="0 0 400 28" preserveAspectRatio="none"><path d="M0 20 q25 -6 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V28 H0 Z" fill="var(--lake)" opacity=".55" /></svg>
    <svg className="railfish" style={{ left: `${p * 100}%` }} viewBox="0 0 40 20" width="30" height="15"><path d="M6 10 C 12 2 28 2 36 10 C 28 18 12 18 6 10 Z" fill="var(--coral)" /><path d="M8 10 L0 4 L0 16 Z" fill="var(--coral)" /><circle cx="30" cy="9" r="1.6" fill="var(--sky)" /></svg></div>;
}
function MarginScene() {
  const p = useReadProgress();
  return <div className="marginscene" aria-hidden="true"><LakeScene pose="read" progress={p} /></div>;
}
function StartScene() { return <div className="lakewrap compact" aria-hidden="true"><LakeScene pose="read" progress={0} /></div>; }
function EndScene() { const p = useReadProgress(); return <div className="lakewrap compact endscene" aria-hidden="true"><LakeScene pose="read" progress={ease(p, 0.82)} /></div>; }

const PAIRS = [['moon', 'cheese'], ['honey', 'Venus'], ['wombat', 'cube'], ['tea', 'railway'], ['octopus', 'copper'], ['monsoon', 'sailor']];
function Finder({ me, send }: { me: Me; send: Send }) {
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [found, setFound] = useState<any>(null); const [copied, setCopied] = useState(false);
  const q = me.access.finderQuota;
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(''); setFound(null); setCopied(false); send('tab_change_finder');
    const r = await api('/finder', { a, b }); setBusy(false); if (r.data.ok) { setFound(r.data); send('finder_result'); } else { setMsg(r.data.message || r.data.error || ''); send('tab_change_other'); }
  }
  const random = () => { const p = PAIRS[Math.floor(Math.random() * PAIRS.length)]; setA(p[0]); setB(p[1]); };
  const line = found ? `${found.a.title} and ${found.b.title} both point to ${found.bridge.via} (per Wikipedia: "${found.bridge.sentA}" / "${found.bridge.sentB}").` : '';
  async function copy() { try { await navigator.clipboard.writeText(line); setCopied(true); } catch { setCopied(false); } }
  return <section className="lab">
    <LakeScene pose="read" /><p className="kicker">Connections · early version</p><h1 className="story-title">The curiosity lab.</h1>
    <p className="deck">Give it two things that have nothing to do with each other. The rabbit looks for a topic that both Wikipedia pages mention and shows you the sentences. Some pairs have no bridge, and then it says so.</p>
    <form onSubmit={go} className="pair-form">
      <div className="pair"><label>Thing one<input type="text" placeholder="moon" value={a} onChange={(e) => setA(e.target.value)} /></label>
        <button type="button" className="swap" aria-label="Swap the two words" onClick={() => { setA(b); setB(a); }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" /></svg></button>
        <label>Thing two<input type="text" placeholder="cheese" value={b} onChange={(e) => setB(e.target.value)} /></label></div>
      <p className="row-actions"><button type="button" className="ghost" onClick={random}>Surprise me with a pair</button><button className="go" disabled={busy || !a.trim() || !b.trim()}>{busy ? 'Following the thread…' : 'Find the connection'}</button></p>
    </form>
    {msg && <p className="note bubble" role="status">{msg}</p>}
    {found && <article className="bridge" role="status"><p className="kicker">A sourced bridge</p><BridgeViz a={found.a.title} b={found.b.title} via={found.bridge.via} />
      <h2 className="serif"><em>{found.a.title}</em> and <em>{found.b.title}</em> both point to <em>{found.bridge.via}</em>.</h2>
      <p className="note">These sentences are copied from the two Wikipedia pages, and each mentions "{found.bridge.via}".</p>
      <blockquote>“{found.bridge.sentA}”<cite><a href={found.a.url} target="_blank" rel="noreferrer">{found.a.title} (Wikipedia)</a></cite></blockquote>
      <blockquote>“{found.bridge.sentB}”<cite><a href={found.b.url} target="_blank" rel="noreferrer">{found.b.title} (Wikipedia)</a></cite></blockquote>
      {found.inference && <p><span className="tag">Rabbit's guess, not sourced</span> {found.inference}</p>}
      {found.alternatives?.length > 0 && <p className="note">Other shared topics: {found.alternatives.join(', ')}.</p>}
      <p className="note">Both pages mentioning a topic is a lead, not proof the two things are closely related.</p>
      <p className="row-actions"><a className="ghost btn" href={found.a.url} target="_blank" rel="noreferrer">Tell me more: {found.a.title}</a><a className="ghost btn" href={found.b.url} target="_blank" rel="noreferrer">{found.b.title}</a><button type="button" className="ghost" onClick={copy}>{copied ? 'Copied' : 'Copy a line to share'}</button></p></article>}
    <aside className="fine-block"><p className="kicker">How this works for now</p><ul className="ticks"><li>Every bridge shows the sentences it came from, with links, so you can check it.</li><li>If there is no bridge, the rabbit says so instead of making one up.</li><li>Anything the rabbit adds is labelled as its own guess.</li></ul>{q && <p className="mono-note">Your plan: {q.limit} {q.limit === 1 ? 'try' : 'tries'} per {q.period}.</p>}</aside>
  </section>;
}

function Trail({ me, onOpen }: { me: Me; onOpen: (id: string) => void }) {
  const [board, setBoard] = useState<any[]>([]); const [code, setCode] = useState(''); const [join, setJoin] = useState(''); const [msg, setMsg] = useState(''); const [hist, setHist] = useState<any>(null); const [cal, setCal] = useState<any>(null);
  const load = () => api('/leaderboard').then((r) => setBoard(r.data.board || []));
  useEffect(() => { load(); api('/history').then((r) => r.ok && setHist(r.data)); api('/calendar').then((r) => r.ok && setCal(r.data)); }, []);
  const marks = [3, 7, 30];
  return <section>
    <p className="kicker">Trail</p><h1 className="story-title">{me.streak.current ? `Day ${me.streak.current} on the trail.` : 'The trail starts with one detour.'}</h1>
    <Emblem n={me.streak.current} best={me.streak.longest} />
    <NextMark n={me.streak.current} marks={marks} />
    {cal && <WeekRow cal={cal} />}
    <p className="mono-note">freezes saved {me.streak.freezesLeft} · extra trails {me.streak.bonusHoles}</p>
    <p className="note">No need to read every day. A freeze covers a missed day. Curiosity isn't homework.</p>
    {cal && <MonthCalendar cal={cal} />}
    <p className="note">Marks are only marks on your trail. There are no prizes behind them yet.</p>
    <details className="scenes"><summary>Peek at the forest scenes</summary><p className="note">Previews of scenes you'll meet. This is not your status.</p><div className="pair-scenes"><figure><ForestScene kind="carrot" /><figcaption className="mono-note">After you finish a story</figcaption></figure><figure><ForestScene kind="fox" /><figcaption className="mono-note">If you come back after missing a day. The rabbit is safe.</figcaption></figure></div></details>
    <h2 className="serif">What you've wandered through</h2>
    {hist && hist.items.length > 0 && <InterestBars items={hist.items} />}
    {!hist ? <p className="note" role="status">Reading the journal…</p> : hist.items.length === 0 ? <p className="note">Nothing yet. Your first detour will show up here.</p>
      : <ol className="journal">{hist.items.map((x: any) => <li key={x.day + x.topicId}><span className="jg" aria-hidden="true">{x.tags.slice(0, 2).map((t: string) => <TagGlyph key={t} tag={t} size={18} />)}</span><span className="mono">{x.day}</span><button type="button" className="linklike" onClick={() => onOpen(x.topicId)}>{x.title}</button>{!x.done && <span className="mono-note"> opened, not finished</span>}</li>)}</ol>}
    <h2 className="serif">Friends on the trail</h2>
    {board.length <= 1 ? <p className="note">It's quiet out here. Invite a friend to walk it with you.</p> : null}
    <ol className="board" aria-label="Friends streak leaderboard">{board.map((r, i) => <li key={i} className={'row' + (r.me ? ' me' : '')}><span className="rank mono">{i + 1}</span><span className="nm">{r.name}{r.me ? ' (you)' : ''}</span><span className="mono">{r.streak} day{r.streak === 1 ? '' : 's'}</span></li>)}</ol>
    <p><button type="button" className="ghost" onClick={async () => { const r = await api('/invite', {}); setCode(r.data.code || ''); if (!r.ok) setMsg(r.data.error || r.data.message || ''); }}>Get an invite code</button></p>
    {code && <p role="status">Share this code: <strong className="mono">{code}</strong></p>}
    <label>Have a friend's code?<input type="text" value={join} onChange={(e) => setJoin(e.target.value)} /></label>
    <p><button type="button" className="ghost" onClick={async () => { const r = await api('/join', { code: join }); setMsg(r.ok ? 'Friend added!' : r.data.error); if (r.ok) load(); }}>Add friend</button></p>
    {msg && <p className="note" role="status">{msg}</p>}
    <div className="lakewrap"><LakeScene pose="fish" /></div>
  </section>;
}

function You({ me, cfg, onRedo, onOpen }: { me: Me; cfg: Cfg; onRedo: () => void; onOpen: (id: string) => void }) {
  const [saved, setSaved] = useState<any[] | null>(null); const [hist, setHist] = useState<any>(null);
  useEffect(() => { api('/saved').then((r) => r.ok && setSaved(r.data.items)); api('/history').then((r) => r.ok && setHist(r.data)); }, []);
  const p = me.prefs; const fmtName = (id: string) => cfg.formats.find((f) => f.id === id)?.label ?? id;
  const mins = hist ? Math.round(hist.recorded.seconds / 60) : 0;
  return <section className="you">
    <p className="kicker">You</p><h1 className="story-title">{me.user.name ? `${me.user.name}'s corner.` : 'Your corner.'}</h1><p className="mono-note">{me.user.email}</p>
    <h2 className="serif">How you like your stories</h2>
    {p ? <dl className="prefs"><dt>Topics</dt><dd>{p.interestTags.join(', ')}</dd><dt>Shape</dt><dd>{p.formats.map(fmtName).join(', ')}</dd><dt>Length</dt><dd>{p.length === 'short' ? 'A quick nibble' : 'A good chew'}</dd>{p.quiz?.country && <><dt>Country</dt><dd>{(cfg.countries ?? []).find((c) => c.code === p.quiz.country)?.name ?? p.quiz.country}</dd></>}</dl> : <p className="note">No answers yet.</p>}
    <p><button type="button" className="ghost" onClick={onRedo}>Change my answers</button></p>
    <h2 className="serif">Saved discoveries</h2>
    {saved === null ? <p className="note" role="status">Checking your shelf…</p> : saved.length === 0 ? <p className="note">Nothing saved yet. Use "Save for later" on a story you want to find again.</p>
      : <ul className="journal">{saved.map((x) => <li key={x.topicId}><button type="button" className="linklike" onClick={() => onOpen(x.topicId)}>{x.title}</button><span className="note"> {x.hook}</span></li>)}</ul>}
    {cfg.weather && <CitySetting />}
    <h2 className="serif">Learning history and privacy</h2>
    <p>What the app keeps about your reading: which story you were shown each day, how long you had it open, and whether you finished. It uses topic tags from stories you finish to choose what comes next, along with your answers above. Time spent is not treated as how much you learned.</p>
    {hist && <p className="mono-note">{hist.recorded.reads} opened · {hist.recorded.completed} finished · about {mins} min total</p>}
    <p className="note">Your notes and answers are used only for choosing stories in this app. You can change them any time above. A control to clear your history is not built yet.</p>
    <h2 className="serif">Notifications</h2>
    <p className="note">Not available yet. The app sends no reminders, emails or push messages, and has no switches to set.</p>
    <h2 className="serif">Plan</h2>
    <Plan me={me} cfg={cfg} />
  </section>;
}

type City = [number, string, string, string, number, number];
let cityCache: City[] | null = null;
const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Optional weather city. The list is a static file searched here in the browser: what you type never leaves your device. Only the chosen city is saved.
function CitySetting() {
  const [cur, setCur] = useState<{ name: string; country: string } | null | undefined>(undefined);
  const [q, setQ] = useState(''); const [list, setList] = useState<City[] | null>(cityCache); const [msg, setMsg] = useState('');
  const names = useMemo(() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return null; } }, []);
  useEffect(() => { api('/city').then((r) => setCur(r.ok ? r.data.city : null)); }, []);
  async function open() { if (list) return; const r = await fetch('/cities.json'); cityCache = await r.json(); setList(cityCache); }
  const hits = useMemo(() => { const n = norm(q.trim()); if (!list || n.length < 2) return []; const out: City[] = []; for (const c of list) { if (norm(c[1]).startsWith(n) || (c[2] && norm(c[2]).startsWith(n))) { out.push(c); if (out.length >= 6) break; } } return out; }, [q, list]);
  async function save(id: number | null) { const r = await api('/city', { id }); if (r.ok) { setCur(r.data.city); setQ(''); setMsg(id === null ? 'City removed. The sky goes back to the time of day.' : 'Saved. The sky will follow the weather there.'); window.dispatchEvent(new Event('city-changed')); } else setMsg('Could not save that city.'); }
  const cn = (cc: string) => names?.of(cc) ?? cc;
  return <div className="citybox">
    <h2 className="serif">Weather in the sky</h2>
    <p className="note">Optional. Pick a nearby city and the lake can turn cloudy, rainy or misty with the weather there, still in autumn colours. No GPS or device location is used. What you type stays in your browser; only the city you pick is saved to your account, and only its rounded position (about 1 km) goes to the weather service.</p>
    {cur ? <p>Your city: <strong>{cur.name}, {cn(cur.country)}</strong> <button type="button" className="ghost" onClick={() => save(null)}>Remove</button></p> : cur === null && <p className="note">No city set. The sky follows the time of day only.</p>}
    <label htmlFor="cityq">Search for a city</label>
    <input id="cityq" type="text" autoComplete="off" value={q} placeholder="for example Delhi" onFocus={open} onChange={(e) => { setQ(e.target.value); open(); }} />
    {hits.length > 0 && <ul className="cityhits">{hits.map((c) => <li key={c[0]}><button type="button" className="linklike" onClick={() => save(c[0])}>{c[1]}, {cn(c[3])}</button></li>)}</ul>}
    {q.trim().length >= 2 && list && hits.length === 0 && <p className="note">No match. Cities under 15,000 people are not listed; try a bigger one nearby.</p>}
    {msg && <p className="note" role="status">{msg}</p>}
    <p className="mono-note">Weather: Data from MET Norway. City list: GeoNames (CC BY 4.0).</p>
  </div>;
}

function Plan({ me, cfg }: { me: Me; cfg: Cfg }) {
  const p = cfg.plans;
  const [msg, setMsg] = useState('');
  async function buy(plan: string) { const r = await api('/checkout', { plan }); if (r.ok && r.data.url) window.location.href = r.data.url; else setMsg(r.data.message || 'Could not start checkout.'); }
  const per = (x: any) => (x.period === 'day' ? 'a day' : x.period === 'week' ? 'a week' : x.period);
  return <div className="plan-block">
    <p>{me.access.plan === 'trial' ? 'You are on the free 3-day trial.' : `Current plan: ${me.access.plan}.`}{me.access.plan === 'trial' && <span className="mono-note"> ends {new Date(me.access.trialEndsAt).toLocaleString()}</span>}</p>
    <p className="note">One rabbit hole a day. No endless feed, ever. Paid plans are billed monthly in USD. Renewal and cancellation terms are not set yet, so none are shown. Nothing can be charged.</p>
    <div className="plans">{([['plan3', 'Little burrow', '$3'], ['plan5', 'Deep warren', '$5']] as const).map(([k, l, pr]) => <div className="plan" key={k}>
      <h3 className="serif">{l}</h3><p className="price mono">{pr}<small> / {p[k].billing ?? 'billing period to be decided'}</small></p>
      <ul className="ticks"><li>A personalised rabbit hole every day</li><li>Connection finder: {p[k].connection_finder.limit} {p[k].connection_finder.limit === 1 ? 'try' : 'tries'} {per(p[k].connection_finder)}</li><li>Streak freezes: not decided yet</li></ul>
      {cfg.payments === 'test_mode' ? <button type="button" className="ghost" onClick={() => buy(k)}>Start {l} (test mode, no real charge)</button> : <button type="button" className="ghost" disabled>Payments not switched on yet</button>}</div>)}</div>
    {msg && <p className="note" role="status">{msg}</p>}
    <p className="note">Payments are not live; nothing can be charged in this preview.</p>
  </div>;
}
