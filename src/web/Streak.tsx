import React, { useEffect, useRef, useState } from 'react';
import { countUp, petalBurst } from './motion';
import { PacoBunny } from './Paco';

type Cal = { today: string; read: string[] };
type Streak = { current: number; longest: number; freezesLeft: number; bonusHoles: number; readToday: boolean };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, k: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return iso(d); };
const dow = (s: string) => (new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7; // Monday = 0
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const short = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// Small round faces, drawn rather than typed as emoji so they stay crisp and match the theme.
function Face({ mood }: { mood: 'happy' | 'flat' | 'sleepy' | 'dot' }) {
  return <svg className="face" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
    {mood === 'dot' ? <circle cx="14" cy="14" r="2.6" fill="currentColor" /> : <>
      <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {mood === 'sleepy' ? <path d="M8.500 11.500q2.500 2 5 0M15.500 11.500q2.500 2 5 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : <><circle cx="9.800" cy="11.500" r="1.700" fill="currentColor" /><circle cx="18.200" cy="11.500" r="1.700" fill="currentColor" /></>}
      <path d={mood === 'happy' ? 'M8.800 16.500q5.200 5.200 10.400 0' : mood === 'sleepy' ? 'M10 19.500q4-2.500 8 0' : 'M10 18.500h8'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>}
  </svg>;
}
const Sparks = () => <svg className="sparks" viewBox="0 0 200 120" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round"><path d="M20 70l8-4M16 50l9 1M30 28l6 7M170 40l8-6M178 62l9 2M150 18l3 9" /></g><g fill="currentColor"><path d="M44 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M162 96l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" /></g></svg>;

const MARKS: [number, string, string][] = [[3, 'First footprints', 'three days on the trail'], [7, 'A full week', 'seven days in a row'], [30, 'A month of detours', 'thirty days in a row']];
function MarkIcon({ i }: { i: number }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {i === 0 ? <path d="M12 20v-9M12 11c-4 0-6-2-6-5 4 0 6 2 6 5zM12 13c3 0 5-1.500 5-4-3 0-5 1.500-5 4z" /> : i === 1 ? <path d="M12 3v3M4.500 7.500l2 2M19.500 7.500l-2 2M3 14h3M18 14h3M8 20a4 4 0 1 1 8 0z" /> : <path d="M12 21v-6M12 15c-5 0-7-3-7-6 3 0 5 1 7 3 2-2 4-3 7-3 0 3-2 6-7 6zM12 12V3M9 6l3-3 3 3" />}
  </svg>;
}

export function StreakBoard({ name, streak, cal, onRead, onSaved }: { name: string | null; streak: Streak; cal: Cal | null; onRead: () => void; onSaved: () => void }) {
  const a = useRef<SVGGElement>(null), b = useRef<SVGGElement>(null), c = useRef<SVGGElement>(null);
  const n = streak.current; const numRef = useRef<HTMLParagraphElement>(null); const [grown, setGrown] = useState(false);
  // The number counts up, the bars fill, and a streak sends up a few petals.
  useEffect(() => { countUp(numRef.current, n); const t = window.setTimeout(() => setGrown(true), 250); const u = n > 0 ? window.setTimeout(() => { const b = numRef.current?.getBoundingClientRect(); if (b) petalBurst(b.left + b.width / 2, b.top + b.height / 2, Math.min(22, 8 + n)); }, 900) : 0; return () => { clearTimeout(t); clearTimeout(u); }; }, [n]);
  const today = cal?.today ?? iso(new Date()); const mon = addDays(today, -dow(today)); const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i)); const read = cal?.read ?? [];
  const msg = n === 0 ? 'The trail starts with one detour. Take a small one today.' : n < 3 ? "That's a great start. One story a day is all it takes." : n < 7 ? 'You are finding a rhythm. Keep following what is interesting.' : 'A whole week of wandering. Curiosity looks good on you.';
  return <div className="streakboard">
    <section className="streak-card sc-left" aria-label="Your streak">
      <div className="sc-art"><Sparks /><p className="sc-num" ref={numRef} aria-label={`${n} ${n === 1 ? 'day' : 'days'} on the trail`}>{n}</p>
        <div className="bunny streak-rabbit b-cheer" aria-hidden="true"><PacoBunny state="idle" pupils={a} head={b} ears={c} /></div></div>
      <div className="sc-text"><h2 className="sc-title">{n === 1 ? 'Day' : 'Days'} on the trail</h2><p>{msg}</p><p className="mono-note">best {streak.longest} · freezes saved {streak.freezesLeft} · extra trails {streak.bonusHoles}</p>
        <button type="button" className="go" onClick={onRead}>{streak.readToday ? 'See today\'s detour' : 'Read today\'s story'}</button></div>
    </section>
    <section className="streak-card sc-right" aria-label="This week and trail marks">
      <header className="sc-head"><p className="mono-note">{new Date(today + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</p>
        <h2 className="sc-hey">Hey, <strong>{name ?? 'wanderer'}</strong>!</h2>
        <p className="sc-quote">Curiosity isn't homework. Beginning is enough.</p></header>
      <div className="sc-body">
        <h3 className="sc-h">My <strong>Week</strong></h3><p className="mono-note sc-range">from: <b>{short(days[0])}</b> to: <b>{short(days[6])}</b></p>
        <ol className="pills" aria-label="This week">{days.map((d, i) => { const r = read.includes(d), t = d === today, fut = d > today; const mood = r ? 'happy' : t ? 'flat' : fut ? 'dot' : 'sleepy';
          return <li key={d} className={'pill-day' + (r ? ' r' : '') + (t ? ' t' : '') + (fut ? ' fut' : '')} style={{ ['--i' as string]: i }}><Face mood={mood} /><b>{+d.slice(8)}</b><span>{WD[i]}</span><span className="sr">{r ? ', read' : t ? ', today' : fut ? ', upcoming' : ', not read'}</span></li>; })}</ol>
        <h3 className="sc-h">My <strong>Trail marks</strong></h3>
        <ul className="marks2">{MARKS.map(([m, label, sub], i) => { const done = streak.longest >= m; const pct = Math.min(100, Math.round((n / m) * 100));
          return <li key={m} className={done ? 'done' : ''}><span className="mi"><MarkIcon i={i} /></span><span className="mt"><b>{label}</b><small>{done ? 'reached' : `${n} of ${m} · ${sub}`}</small></span><span className="mbar" aria-hidden="true"><i style={{ width: grown ? `${done ? 100 : pct}%` : '0%' }} /></span></li>; })}</ul>
        <button type="button" className="outline" onClick={onSaved}>Saved discoveries</button>
      </div>
    </section>
  </div>;
}
