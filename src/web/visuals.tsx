import React from 'react';

const G: Record<string, React.ReactNode> = {
  food: <><path d="M5 11h11v3a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path d="M16 12h1.500a2 2 0 0 1 0 4H16" /><path d="M8 4c-1 1 1 2 0 3M12 4c-1 1 1 2 0 3" /></>,
  science: <><path d="M10 3h4M11 3v6l-5 9a1.500 1.500 0 0 0 1.300 2.200h9.400A1.500 1.500 0 0 0 18 18l-5-9V3" /><path d="M8.500 14h7" /></>,
  history: <><path d="M3 10l9-6 9 6z" /><path d="M4 20h16M6 20v-9M10 20v-9M14 20v-9M18 20v-9" /></>,
  animals: <><ellipse cx="12" cy="16" rx="5" ry="4" /><circle cx="6" cy="10.500" r="2" /><circle cx="10" cy="7" r="2" /><circle cx="14.500" cy="7" r="2" /><circle cx="18.500" cy="10.500" r="2" /></>,
  space: <><circle cx="12" cy="12" r="4.500" /><path d="M3 15.500c4 2.500 13-1 18-7" /><path d="M19 4v3M17.500 5.500h3" /></>,
  places: <><path d="M12 21s-6-5.500-6-10a6 6 0 0 1 12 0c0 4.500-6 10-6 10z" /><circle cx="12" cy="11" r="2.200" /></>,
  nature: <><path d="M5 19c0-9 5-14 14-14 0 9-5 14-14 14z" /><path d="M5 19l8-8" /></>,
  'everyday life': <><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-5h4v5" /></>,
  'money & tech': <><circle cx="12" cy="12" r="8" /><path d="M12 7v10M9.500 9.800c0-1.800 5-1.800 5 0s-5 1.600-5 3.400 5 1.800 5 0" /></>,
};
const FALLBACK = <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>;

export function TagGlyph({ tag, size = 22 }: { tag: string; size?: number }) {
  return <svg className="glyph" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{G[tag] ?? FALLBACK}</svg>;
}

// Decorative plate for a story: its own tags drawn as large line glyphs along a dashed trail over soft hills.
export function Plate({ tags }: { tags: string[] }) {
  const t = tags.slice(0, 3); const xs = t.length === 1 ? [160] : t.length === 2 ? [95, 225] : [60, 160, 260]; const cols = ['var(--moss)', 'var(--amber)', 'var(--coral)'];
  return <svg className="plate" viewBox="0 0 320 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <path d="M0 96c40-22 70-22 110-6s80 14 120-4 60-10 90-2V120H0z" fill="var(--bg2)" />
    <path d="M0 100c50-14 90-10 130 2s100 8 190-8" fill="none" stroke="var(--line)" strokeWidth="1.2" />
    {xs.length > 1 && <path d={`M${xs[0]} 64 C ${(xs[0] + xs[xs.length - 1]) / 2} 100, ${(xs[0] + xs[xs.length - 1]) / 2} 30, ${xs[xs.length - 1]} 64`} fill="none" stroke="var(--ctl)" strokeWidth="1.4" strokeDasharray="3 6" strokeLinecap="round" />}
    {t.map((tag, i) => <g key={tag} transform={`translate(${xs[i] - 24} 36) scale(2)`} style={{ color: cols[i] }}><circle cx="12" cy="12" r="13" fill="var(--bg)" stroke="var(--line)" strokeWidth=".6" /><g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">{G[tag] ?? FALLBACK}</g></g>)}
  </svg>;
}

// Winding trail: one stop per day this week of the current streak (capped at 7), filled for days walked.
export function TrailPath({ n, of = 7 }: { n: number; of?: number }) {
  const w = 640, h = 120; const k = Math.min(n, of);
  const pts = Array.from({ length: of }, (_, i) => ({ x: 40 + (i * (w - 80)) / (of - 1), y: i % 2 === 0 ? 66 : 38 }));
  const d = pts.map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `S${(pts[i - 1].x + p.x) / 2} ${i % 2 ? 6 : 100} ${p.x} ${p.y}`)).join(' ');
  const done = k > 0 ? pts.slice(0, k).map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `S${(pts[i - 1].x + p.x) / 2} ${i % 2 ? 6 : 100} ${p.x} ${p.y}`)).join(' ') : '';
  return <svg className="trailpath" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${k} of ${of} stops walked on this trail${n > of ? ` (streak is ${n} days)` : ''}`}>
    <path d={d} fill="none" stroke="var(--ctl)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
    {done && <path d={done} fill="none" stroke="var(--moss)" strokeWidth="2.4" strokeLinecap="round" />}
    {pts.map((p, i) => <g key={i} transform={`translate(${p.x - 11} ${p.y - 11})`}>
      <circle cx="11" cy="11" r="17" fill="var(--bg)" stroke={i < k ? 'var(--moss)' : 'var(--ctl)'} strokeWidth="1.4" />
      <g transform="translate(-1 -1)" fill={i < k ? 'var(--moss)' : 'none'} stroke={i < k ? 'var(--moss)' : 'var(--ctl)'} strokeWidth="1.4" style={{ transform: 'translate(-1px,-1px) scale(.95)' }}>{G.animals}</g>
      {i === k - 1 && <circle className="here" cx="11" cy="11" r="19" fill="none" stroke="var(--amber)" strokeWidth="1.4" />}
    </g>)}
    <text x={pts[0].x} y={h - 2} textAnchor="middle" className="svgt">day 1</text><text x={pts[of - 1].x} y={h - 2} textAnchor="middle" className="svgt">day {of}</text>
  </svg>;
}

// Milestone line: ticks at 3, 7, 30 filled to the user's real best streak.
export function MilestoneLine({ best, marks }: { best: number; marks: number[] }) {
  const max = marks[marks.length - 1]; const pct = (v: number) => 4 + (Math.min(v, max) / max) * 92;
  return <svg className="mline" viewBox="0 0 100 22" preserveAspectRatio="none" role="img" aria-label={`Best streak ${best} days. Marks at ${marks.join(', ')} days.`}>
    <line x1="4" y1="8" x2="96" y2="8" stroke="var(--ctl)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    {best > 0 && <line x1="4" y1="8" x2={pct(best)} y2="8" stroke="var(--moss)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
    {marks.map((m) => <line key={m} x1={pct(m)} y1="3" x2={pct(m)} y2="13" stroke={best >= m ? 'var(--moss)' : 'var(--ctl)'} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
  </svg>;
}

// Count of tags across the user's own journal. Real history only.
export function InterestBars({ items }: { items: { tags: string[] }[] }) {
  const c = new Map<string, number>(); items.forEach((x) => x.tags.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
  const rows = [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6); const max = rows[0]?.[1] ?? 1;
  if (!rows.length) return null;
  return <ul className="ibars" aria-label="Topics in your journal">{rows.map(([t, n]) => <li key={t}><TagGlyph tag={t} size={18} /><span className="nm">{t}</span><span className="bar" aria-hidden="true"><i style={{ width: `${(n / max) * 100}%` }} /></span><span className="mono">{n}</span></li>)}</ul>;
}

// Two things, one shared topic, drawn as a bridge. Labels are the real titles from the result.
export function BridgeViz({ a, b, via }: { a: string; b: string; via: string }) {
  return <div className="bviz"><span className="n">{a}</span><svg viewBox="0 0 60 30" aria-hidden="true"><path d="M2 24C14 2 46 2 58 24" fill="none" stroke="var(--moss)" strokeWidth="1.6" strokeDasharray="3 4" strokeLinecap="round" /></svg><span className="n via">{via}</span><svg viewBox="0 0 60 30" aria-hidden="true"><path d="M2 24C14 2 46 2 58 24" fill="none" stroke="var(--moss)" strokeWidth="1.6" strokeDasharray="3 4" strokeLinecap="round" /></svg><span className="n">{b}</span></div>;
}

export function LabArt() {
  return <svg className="labart" viewBox="0 0 320 90" aria-hidden="true" focusable="false"><circle cx="50" cy="60" r="14" fill="none" stroke="var(--amber)" strokeWidth="1.5" /><circle cx="270" cy="60" r="14" fill="none" stroke="var(--coral)" strokeWidth="1.5" /><path d="M64 56C110 0 210 0 256 56" fill="none" stroke="var(--ctl)" strokeWidth="1.5" strokeDasharray="3 6" strokeLinecap="round" /><text x="160" y="34" textAnchor="middle" className="svgt big">?</text></svg>;
}

// ---- Trail centrepiece, week row, next mark, month calendar. All from her real read days. ----
export function Emblem({ n, best }: { n: number; best: number }) {
  const k = Math.min(n, 7); const R = 74;
  return <figure className="emblem"><svg viewBox="0 0 200 200" role="img" aria-label={`${n} day streak. Personal best ${best}.`}>
    <circle cx="100" cy="100" r="90" fill="var(--bg2)" stroke="var(--line)" strokeWidth="1.2" />
    <path d="M52 150a48 48 0 0 1 96 0z" fill="var(--bg)" stroke="var(--ctl)" strokeWidth="1.4" />
    {Array.from({ length: 7 }, (_, i) => { const a = (-90 + i * (360 / 7)) * Math.PI / 180; const x = 100 + R * Math.cos(a), y = 100 + R * Math.sin(a); const on = i < k;
      return <g key={i} transform={`translate(${x - 9} ${y - 9}) scale(.75)`} fill={on ? 'var(--moss)' : 'none'} stroke={on ? 'var(--moss)' : 'var(--ctl)'} strokeWidth="1.5">{G.animals}</g>; })}
    <text x="100" y="128" textAnchor="middle" className="emn">{n}</text>
  </svg><figcaption className="mono-note">{n === 1 ? 'day' : 'days'} on the trail · best {best}</figcaption></figure>;
}

export function NextMark({ n, marks }: { n: number; marks: number[] }) {
  const next = marks.find((m) => m > n); const prev = [...marks].reverse().find((m) => m <= n) ?? 0;
  if (!next) return <p className="note">You have reached every mark on the trail so far.</p>;
  const pct = ((n - prev) / (next - prev)) * 100;
  return <div className="nextmark"><div className="track" role="img" aria-label={`${n} of ${next} days to the next mark`}><i style={{ width: `${Math.max(2, pct)}%` }} /><svg className="pin" width="22" height="26" viewBox="0 0 22 26" aria-hidden="true"><path d="M6 3v21" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" /><path d="M6 4c4-2 6 2 10 0v8c-4 2-6-2-10 0z" fill="var(--amber)" /></svg></div><p className="mono-note">Next mark: {next} days · {next - n} to go</p></div>;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, k: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return iso(d); };
const dow = (s: string) => (new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7; // Monday = 0
const L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeekRow({ cal }: { cal: { today: string; read: string[] } }) {
  const mon = addDays(cal.today, -dow(cal.today)); const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  return <ol className="week" aria-label="This week">{days.map((d, i) => { const r = cal.read.includes(d), f = false, t = d === cal.today, fut = d > cal.today;
    return <li key={d} className={(r ? 'r ' : '') + (f ? 'f ' : '') + (t ? 't ' : '') + (fut ? 'fut' : '')}><span className="dl mono">{L[i]}</span><span className="dot" aria-label={`${d}${r ? ', read' : f ? ', covered by a freeze' : t ? ', today' : fut ? ', upcoming' : ', no read'}`}>{r ? <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--bg)" aria-hidden="true">{G.animals}</svg> : f ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--amber)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 3v18M4 7.500l16 9M20 7.500l-16 9" /></svg> : null}</span></li>; })}</ol>;
}

export function MonthCalendar({ cal }: { cal: { today: string; read: string[] } }) {
  const [ym, setYm] = React.useState(cal.today.slice(0, 7));
  const first = ym + '-01'; const y = +ym.slice(0, 4), m = +ym.slice(5, 7); const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(dow(first)).fill(null), ...Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)];
  const shift = (k: number) => setYm(iso(new Date(Date.UTC(y, m - 1 + k, 1))).slice(0, 7));
  const isNow = ym === cal.today.slice(0, 7);
  const name = new Date(first + 'T00:00:00Z').toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const reads = cal.read.filter((d) => d.startsWith(ym)).length;
  return <div className="cal"><div className="calhead"><h3 className="serif">{name}</h3><span><button type="button" className="sq" aria-label="Previous month" onClick={() => shift(-1)}>‹</button><button type="button" className="sq" aria-label="Next month" disabled={isNow} onClick={() => shift(1)}>›</button></span></div>
    <p className="mono-note">{reads} {reads === 1 ? 'day' : 'days'} read</p>
    <div className="grid" role="grid" aria-label={name}>{L.map((l, i) => <span key={i} className="dh mono" role="columnheader">{l}</span>)}
      {cells.map((d, i) => d === null ? <span key={'e' + i} /> : <span key={d} role="gridcell" className={'c' + (cal.read.includes(d) ? ' r' : '') + '' + (d === cal.today ? ' t' : '')} aria-label={`${d}${cal.read.includes(d) ? ', read' : ''}`}>{+d.slice(8)}</span>)}</div>
    <p className="legend mono-note"><i className="k r" /> read <i className="k t" /> today</p>
    <p className="fine">A day is marked when you finished that day's story. Unmarked days are just blank, not misses. Freeze days aren't recorded, so they aren't shown here.</p></div>;
}

// ---- Forest world: trees, and two small scenes. Decorative; the text beside them carries the meaning. ----
const Pine = ({ x, y, s = 1, near = false }: { x: number; y: number; s?: number; near?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={near ? 'rgba(168,198,134,.16)' : 'var(--bg2)'} stroke={near ? 'var(--moss)' : 'var(--ctl)'} strokeWidth="1.4" strokeLinejoin="round">
    <path d="M0 -62 L16 -34 H7 L22 -10 H9 L26 16 H-26 L-9 -10 H-22 L-7 -34 H-16 z" /><path d="M0 16 V30" strokeLinecap="round" fill="none" />
  </g>);
const Round = ({ x, y, s = 1, near = false }: { x: number; y: number; s?: number; near?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={near ? 'rgba(168,198,134,.16)' : 'var(--bg2)'} stroke={near ? 'var(--moss)' : 'var(--ctl)'} strokeWidth="1.4">
    <circle cx="0" cy="-26" r="24" /><path d="M0 -2 V28" fill="none" strokeLinecap="round" /><path d="M0 14 l9 -10" fill="none" strokeLinecap="round" />
  </g>);

export function Treeline() {
  return <svg className="treeline" viewBox="0 0 640 70" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <path d="M0 62H640" stroke="var(--line)" strokeWidth="1.2" />
    {[20, 90, 150, 230, 300, 380, 450, 520, 590].map((x, i) => i % 3 === 1 ? <Round key={x} x={x} y={52} s={.55 + (i % 2) * .15} near={i % 2 === 0} /> : <Pine key={x} x={x} y={46} s={.5 + (i % 3) * .12} near={i % 2 === 0} />)}
  </svg>;
}

function Bunny({ x, y, eat = false, peek = false }: { x: number; y: number; eat?: boolean; peek?: boolean }) {
  const ink = '#3b2a20';
  return <g transform={`translate(${x} ${y})`} className={eat ? 'bunny eat' : 'bunny'}>
    <g className="rears"><ellipse cx="-11" cy="-62" rx="7" ry="20" fill="#f1ebdd" /><ellipse cx="-11" cy="-60" rx="3" ry="12" fill="#d98e7b" /><ellipse cx="11" cy="-62" rx="7" ry="20" fill="#f1ebdd" /><ellipse cx="11" cy="-60" rx="3" ry="12" fill="#d98e7b" /></g>
    {!peek && <ellipse cx="0" cy="-8" rx="34" ry="28" fill="#f1ebdd" />}
    <g className="rhead"><circle cx="0" cy="-34" r="24" fill="#f1ebdd" /><circle cx="-9" cy="-37" r="2.8" fill={ink} /><circle cx="9" cy="-37" r="2.8" fill={ink} /><circle cx="-17" cy="-28" r="4" fill="#d98e7b" opacity=".7" /><circle cx="17" cy="-28" r="4" fill="#d98e7b" opacity=".7" /><ellipse cx="0" cy="-30" rx="2.4" ry="1.8" fill="#d98e7b" /><path d="M-5 -26 Q0 -21 5 -26" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" /></g>
  </g>;
}

export function ForestScene({ kind }: { kind: 'carrot' | 'fox' }) {
  const label = kind === 'carrot' ? 'The rabbit sits among the trees, happily eating a carrot.' : 'A red fox trots past the trees while the rabbit watches safely from its burrow.';
  return <svg className={'scene ' + kind} viewBox="0 0 320 190" role="img" aria-label={label}>
    <Pine x={30} y={128} s={1.1} /><Pine x={288} y={126} s={1.2} /><Round x={76} y={132} s={.9} /><Pine x={250} y={132} s={.8} />
    <path d="M0 150c60-10 120-8 160-2s110 6 160-4V190H0z" fill="var(--bg2)" /><path d="M0 152c60-10 120-8 160-2s110 6 160-4" fill="none" stroke="var(--line)" strokeWidth="1.2" />
    <Pine x={14} y={150} s={1.5} near /><Round x={306} y={152} s={1.3} near />
    {kind === 'carrot' ? <>
      <Bunny x={160} y={150} eat />
      <g transform="translate(160 134)"><g className="carrot"><path d="M-14 -10 L6 -6 L-8 22 z" fill="#e9b96e" /><path d="M-9 -6 l4 1 M-6 3 l4 1" stroke="var(--bg)" strokeWidth="1" opacity=".5" /><path d="M-16 -12 l-4 -9 M-14 -10 l-8 -4 M-12 -8 l-9 1" stroke="var(--moss)" strokeWidth="2.4" strokeLinecap="round" /></g></g>
      <g className="crumbs" fill="#e9b96e"><circle cx="138" cy="146" r="1.8" /><circle cx="184" cy="150" r="1.6" /><circle cx="130" cy="138" r="1.4" /></g>
    </> : <>
      <path d="M232 168 c0-26 56-26 56 0z" fill="var(--bg)" stroke="var(--ctl)" strokeWidth="1.4" />
      <Bunny x={260} y={176} peek />
      <path d="M232 168 c0-26 56-26 56 0z" fill="var(--bg)" stroke="var(--ctl)" strokeWidth="1.4" />
      <g className="foxg"><g transform="translate(70 150)">
        <g className="tail"><path d="M-8 -10 C-44 -26 -52 -2 -34 8 C-24 12 -14 6 -8 -4z" fill="#d98e7b" /><path d="M-34 8 C-42 2 -46 -8 -40 -14 C-50 -6 -46 6 -34 8z" fill="#f1ebdd" /></g>
        <ellipse cx="12" cy="-12" rx="28" ry="15" fill="#d98e7b" /><path d="M-4 0 v14 M22 0 v14 M8 0 v14" stroke="#3b2a20" strokeWidth="4" strokeLinecap="round" />
        <path d="M32 -22 L38 -42 L48 -26z" fill="#d98e7b" /><path d="M38 -22 L48 -40 L52 -22z" fill="#d98e7b" />
        <path d="M30 -24 C36 -34 56 -34 66 -22 L72 -16 L58 -8 C46 -6 34 -10 30 -24z" fill="#d98e7b" /><path d="M58 -8 L72 -16 L64 -4z" fill="#f1ebdd" /><circle cx="73" cy="-16" r="2.4" fill="#3b2a20" /><circle cx="52" cy="-22" r="2" fill="#3b2a20" />
      </g></g>
    </>}
  </svg>;
}
