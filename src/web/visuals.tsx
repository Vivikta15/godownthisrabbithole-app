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
    <path d="M0 96c40-22 70-22 110-6s80 14 120-4 60-10 90-2V120H0z" fill="var(--grass)" opacity=".6" />
    <path d="M0 100c50-14 90-10 130 2s100 8 190-8" fill="none" stroke="var(--line)" strokeWidth="1.2" />
    {xs.length > 1 && <path d={`M${xs[0]} 64 C ${(xs[0] + xs[xs.length - 1]) / 2} 100, ${(xs[0] + xs[xs.length - 1]) / 2} 30, ${xs[xs.length - 1]} 64`} fill="none" stroke="var(--ctl)" strokeWidth="1.4" strokeDasharray="3 6" strokeLinecap="round" />}
    {t.map((tag, i) => <g key={tag} transform={`translate(${xs[i] - 24} 36) scale(2)`} style={{ color: cols[i] }}><circle cx="12" cy="12" r="13" fill="var(--panel)" stroke="var(--line)" strokeWidth=".6" /><g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">{G[tag] ?? FALLBACK}</g></g>)}
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
      <circle cx="11" cy="11" r="17" fill="var(--panel)" stroke={i < k ? 'var(--moss)' : 'var(--ctl)'} strokeWidth="1.4" />
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

// ---- Trail centrepiece, week row, next mark, month calendar. All from her real read days. ----
export function Emblem({ n, best }: { n: number; best: number }) {
  const k = Math.min(n, 7); const R = 74;
  return <figure className="emblem"><svg viewBox="0 0 200 200" role="img" aria-label={`${n} day streak. Personal best ${best}.`}>
    <circle cx="100" cy="100" r="90" fill="var(--panel)" stroke="var(--line)" strokeWidth="1.2" />
    <path d="M52 150a48 48 0 0 1 96 0z" fill="var(--burrow)" opacity=".85" />
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
    return <li key={d} className={(r ? 'r ' : '') + (f ? 'f ' : '') + (t ? 't ' : '') + (fut ? 'fut' : '')}><span className="dl mono">{L[i]}</span><span className="dot" aria-label={`${d}${r ? ', read' : f ? ', covered by a freeze' : t ? ', today' : fut ? ', upcoming' : ', no read'}`}>{r ? <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--panel)" aria-hidden="true">{G.animals}</svg> : f ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--amber)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 3v18M4 7.500l16 9M20 7.500l-16 9" /></svg> : null}</span></li>; })}</ol>;
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

// ---- The illustrated world: solid soft shapes, rounded trees, an autumn accent here and there. ----
const PineS = ({ x, y, s = 1, c = 'var(--pine)' }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={c}>
    <path d="M0 -78 L20 -42 H9 L26 -14 H11 L30 14 H-30 L-11 -14 H-26 L-9 -42 H-20 z" />
    <rect x="-3.5" y="14" width="7" height="13" rx="2" fill="var(--wood-dark)" />
  </g>);
const RoundS = ({ x, y, s = 1, c = 'var(--pine)' }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={c}>
    <rect x="-3" y="-8" width="6" height="22" rx="2.5" fill="var(--wood-dark)" />
    <circle cx="0" cy="-26" r="21" /><circle cx="-14" cy="-16" r="13" /><circle cx="14" cy="-16" r="13" />
  </g>);
const Cloud = ({ x, y, s = 1, cls = '' }: { x: number; y: number; s?: number; cls?: string }) => (
  <g className={'cloud ' + cls} transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="0" rx="36" ry="15" /><ellipse cx="26" cy="-9" rx="23" ry="13" /><ellipse cx="-27" cy="-7" rx="21" ry="11" />
  </g>);

// Fixed full-window backdrop: sun by day (moon and stars at night), drifting clouds, a far pine ridge.
export function SkyLayer() {
  const stars: [number, number, number][] = [[120, 90, 1.8], [220, 160, 1.3], [330, 70, 1.6], [470, 130, 1.2], [560, 60, 1.7], [680, 170, 1.2], [840, 70, 1.5], [920, 150, 1.8], [60, 210, 1.2], [400, 200, 1.1]];
  return <div className="sky" aria-hidden="true">
    <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMax slice">
      <g className="sunwrap"><circle cx="780" cy="128" r="72" fill="var(--sun)" opacity=".22" /><circle className="sun" cx="780" cy="128" r="46" /></g>
      <g className="moonwrap"><circle cx="770" cy="120" r="36" fill="var(--moon)" /><circle cx="758" cy="110" r="31" fill="var(--sky)" /></g>
      {stars.map(([x, y, r], i) => <circle key={i} className="star" cx={x} cy={y} r={r} style={{ animationDelay: `${-i * 0.7}s` }} />)}
      <Cloud x={140} y={120} s={1.15} cls="c1" /><Cloud x={520} y={80} s={.8} cls="c2" /><Cloud x={820} y={190} s={1} cls="c3" />
      <defs><linearGradient id="mistg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--cloud)" stopOpacity="0" /><stop offset=".45" stopColor="var(--cloud)" stopOpacity=".9" /><stop offset="1" stopColor="var(--cloud)" stopOpacity="0" /></linearGradient></defs>
      <g className="wx wx-cloudy"><Cloud x={360} y={110} s={2.2} cls="c2" /><Cloud x={540} y={210} s={2.6} cls="c1" /><Cloud x={660} y={100} s={2.1} cls="c3" /><Cloud x={400} y={330} s={2} cls="c3" /></g>
      <rect className="wx wx-mist" x="-600" y="170" width="2200" height="480" fill="url(#mistg)" />
      <g opacity=".35">
        {[40, 130, 235, 350, 470, 590, 700, 820, 930].map((x, i) => <PineS key={x} x={x} y={700} s={.8 + (i % 3) * .3} c="var(--pine-far)" />)}
        <path d="M0 676 Q 240 640 500 670 T 1000 664 V700 H0 Z" fill="var(--pine-far)" />
      </g>
    </svg>
  </div>;
}

const Fish = ({ x, y, s = 1, c = 'var(--lake-deep)', flip = false, cls = '' }: { x: number; y: number; s?: number; c?: string; flip?: boolean; cls?: string }) => (
  <g className={cls} transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill={c}>
    <path d="M0 0 C 9 -8 24 -8 33 0 C 24 8 9 8 0 0 Z" /><path d="M2 0 L-9 -7 L-9 7 Z" /><circle cx="26" cy="-1.6" r="1.6" fill="var(--lake)" />
  </g>);

// The pier by the lake: the rabbit reads (or simply fishes) among pines and autumn colour.
// progress 0..1 lifts the day's catch toward the surface as a story is read; 1 means caught.
export function LakeScene({ pose = 'fish', progress = 0, hero = false }: { pose?: 'read' | 'fish'; progress?: number; hero?: boolean }) {
  const caught = progress >= 1; const fy = 206 - Math.min(progress, 1) * 56;
  const label = pose === 'read'
    ? 'The rabbit sits on a wooden pier by the lake, reading a book. A fishing line rests in the water' + (progress > 0 ? (caught ? ', and the day\'s catch is on the hook.' : ', and a fish rises as you read.') : '.')
    : 'The rabbit sits on a wooden pier by the lake, fishing among the trees.';
  return <svg className={'lake' + (caught ? ' caught' : '')} viewBox="0 0 640 240" role="img" aria-label={label}>
    <defs><clipPath id="lakeclip"><rect x="0" y="0" width="640" height="134" /></clipPath></defs>
    <RoundS x={84} y={128} s={.9} c="var(--autumn)" /><PineS x={140} y={126} s={1.05} /><RoundS x={238} y={130} s={.7} c="var(--pine)" />
    <PineS x={470} y={124} s={1.2} /><RoundS x={548} y={130} s={.95} c="var(--autumn2)" /><PineS x={612} y={128} s={.85} />
    <g className="lakerain" clipPath="url(#lakeclip)">{[20, 70, 120, 175, 225, 280, 335, 390, 445, 500, 555, 610].map((x, i) => <path key={x} className="drop" d={`M${x} 0 l-6 20`} style={{ animationDelay: `${-((i * 0.31) % 1.1)}s` }} />)}</g>
    <rect x="0" y="134" width="640" height="106" fill="var(--lake)" />
    <rect x="0" y="208" width="640" height="32" fill="var(--lake-deep)" opacity=".35" />
    <path className="ripple" d="M252 172 q10 -4 20 0 M420 196 q10 -4 20 0" /><path className="ripple r2" d="M330 214 q12 -5 24 0 M120 186 q10 -4 20 0" /><path className="ripple r3" d="M520 168 q10 -4 20 0 M210 220 q10 -4 20 0" />
    <Fish x={388} y={182} s={.8} cls="swim" /><Fish x={520} y={212} s={.65} flip cls="swim s2" />
    {!caught && <Fish x={316} y={fy} s={.9} c="var(--coral)" cls="catchfish" />}
    <g stroke="var(--pine)" strokeWidth="2.4" strokeLinecap="round" fill="none"><path d="M22 134 q2 -12 -3 -20 M30 134 q0 -14 5 -22 M40 134 q-2 -10 3 -18" /></g>
    <g><rect x="56" y="112" width="5" height="16" rx="2" fill="var(--wood-dark)" /><ellipse cx="58.5" cy="106" rx="4.5" ry="10" fill="var(--autumn2)" /></g>
    <rect x="6" y="120" width="200" height="15" rx="4" fill="var(--wood)" />
    <path d="M34 120v15M70 120v15M106 120v15M142 120v15M178 120v15" stroke="var(--wood-dark)" strokeWidth="1.6" opacity=".7" />
    <rect x="26" y="135" width="10" height="58" rx="3" fill="var(--wood-dark)" /><rect x="172" y="135" width="10" height="64" rx="3" fill="var(--wood-dark)" />
    {/* the rabbit, side view, sitting at the pier's end */}
    <g transform="translate(148 120)">
      <circle cx="-22" cy="-12" r="7.5" fill="#fdfdf8" />
      <ellipse cx="-2" cy="-22" rx="24" ry="21" fill="#fdfdf8" />
      <ellipse cx="-8" cy="-8" rx="15" ry="9" fill="#fdfdf8" />
      <g className="ear-t"><ellipse cx="9" cy="-70" rx="5.5" ry="18" fill="#fdfdf8" transform="rotate(-13 9 -52)" /><ellipse cx="9" cy="-68" rx="2.6" ry="11" fill="var(--coral)" opacity=".55" transform="rotate(-13 9 -52)" /></g>
      <ellipse cx="20" cy="-73" rx="5.5" ry="19" fill="#fdfdf8" transform="rotate(-4 20 -54)" /><ellipse cx="20" cy="-71" rx="2.6" ry="12" fill="var(--coral)" opacity=".55" transform="rotate(-4 20 -54)" />
      <circle cx="17" cy="-47" r="16.5" fill="#fdfdf8" />
      <circle cx="23" cy="-49" r="2.2" fill="#2f2823" /><circle cx="29.5" cy="-42" r="3.4" fill="var(--coral)" opacity=".45" />
      <ellipse cx="31.5" cy="-45.5" rx="2" ry="1.5" fill="#2f2823" />
      <path d="M2 -38 q12 9 27 3 l-2 9 q-13 5 -26 -4 z" fill="var(--autumn2)" />
      <ellipse cx="18" cy="-22" rx="10" ry="5.5" fill="#f3eee2" transform="rotate(-18 18 -22)" />
      {pose === 'read' ? (
        <g transform="translate(50 -26) rotate(-8)">
          <path d="M0 0 L-19 -4 L-19 14 L0 18 Z" fill="var(--coral)" /><path d="M0 0 L19 -4 L19 14 L0 18 Z" fill="var(--coral)" />
          <path d="M0 1 L-16.5 -2 L-16.5 12.5 L0 15.5 Z" fill="#fffdf4" />
          <g className="pageflip"><path d="M0 1 L16.5 -2 L16.5 12.5 L0 15.5 Z" fill="#fffdf4" /><path d="M3 4 L13 2.4 M3 7.5 L13 5.9 M3 11 L10 10" stroke="var(--line)" strokeWidth="1.1" strokeLinecap="round" /></g>
          <path d="M0 0 L0 18" stroke="var(--wood-dark)" strokeWidth="1.2" />
        </g>
      ) : (
        <g transform="translate(24 -28)"><ellipse cx="0" cy="0" rx="8" ry="5" fill="#f3eee2" transform="rotate(-24)" /></g>
      )}
    </g>
    {/* the rod, propped toward the water */}
    <path d="M168 96 L262 40" stroke="var(--wood-dark)" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="176" cy="90" r="4.5" fill="none" stroke="var(--wood-dark)" strokeWidth="2" />
    <g className="line-end" transform="translate(262 40)"><path d="M0 0 C 3 34 -5 72 1 106" fill="none" stroke="var(--cloud)" strokeWidth="1.6" /></g>
    {caught && <g className="catchfish"><Fish x={266} y={158} s={1} c="var(--coral)" /><path d="M262 146 q3 6 2 10" stroke="var(--cloud)" strokeWidth="1.6" fill="none" /></g>}
    <g className="splash" stroke="var(--cloud)" strokeWidth="2" strokeLinecap="round" fill="none"><path d="M250 152 q4 -8 8 0 M266 148 q4 -8 8 0 M282 152 q4 -8 8 0" /></g>
    {hero && <PineS x={30} y={126} s={1.3} />}
  </svg>;
}

// ---- Forest scenes for streak moments, in the same illustrated language. ----
function Bunny({ x, y, eat = false, peek = false }: { x: number; y: number; eat?: boolean; peek?: boolean }) {
  const ink = '#3b2a20';
  return <g transform={`translate(${x} ${y})`} className={eat ? 'bunny eat' : 'bunny'}>
    <g className="rears"><ellipse cx="-11" cy="-62" rx="7" ry="20" fill="#fdfdf8" /><ellipse cx="-11" cy="-60" rx="3" ry="12" fill="var(--coral)" opacity=".55" /><ellipse cx="11" cy="-62" rx="7" ry="20" fill="#fdfdf8" /><ellipse cx="11" cy="-60" rx="3" ry="12" fill="var(--coral)" opacity=".55" /></g>
    {!peek && <ellipse cx="0" cy="-8" rx="34" ry="28" fill="#fdfdf8" />}
    <g className="rhead"><circle cx="0" cy="-34" r="24" fill="#fdfdf8" /><circle cx="-9" cy="-37" r="2.8" fill={ink} /><circle cx="9" cy="-37" r="2.8" fill={ink} /><circle cx="-17" cy="-28" r="4" fill="var(--coral)" opacity=".5" /><circle cx="17" cy="-28" r="4" fill="var(--coral)" opacity=".5" /><ellipse cx="0" cy="-30" rx="2.4" ry="1.8" fill="var(--coral)" /><path d="M-5 -26 Q0 -21 5 -26" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" /></g>
  </g>;
}

export function ForestScene({ kind }: { kind: 'carrot' | 'fox' }) {
  const label = kind === 'carrot' ? 'The rabbit sits among the trees, happily eating a carrot.' : 'A red fox trots past the trees while the rabbit watches safely from its burrow.';
  return <svg className={'scene ' + kind} viewBox="0 0 320 190" role="img" aria-label={label}>
    <PineS x={30} y={128} s={1.1} /><PineS x={288} y={126} s={1.2} /><RoundS x={76} y={132} s={.9} c="var(--autumn)" /><PineS x={250} y={132} s={.8} />
    <path d="M0 150c60-10 120-8 160-2s110 6 160-4V190H0z" fill="var(--grass)" /><path d="M0 152c60-10 120-8 160-2s110 6 160-4" fill="none" stroke="var(--line)" strokeWidth="1.2" />
    <PineS x={14} y={150} s={1.5} /><RoundS x={306} y={152} s={1.3} c="var(--autumn2)" />
    {kind === 'carrot' ? <>
      <Bunny x={160} y={150} eat />
      <g transform="translate(160 134)"><g className="carrot"><path d="M-14 -10 L6 -6 L-8 22 z" fill="#e8913f" /><path d="M-9 -6 l4 1 M-6 3 l4 1" stroke="#fdfdf8" strokeWidth="1" opacity=".6" /><path d="M-16 -12 l-4 -9 M-14 -10 l-8 -4 M-12 -8 l-9 1" stroke="var(--moss)" strokeWidth="2.4" strokeLinecap="round" /></g></g>
      <g className="crumbs" fill="#e8913f"><circle cx="138" cy="146" r="1.8" /><circle cx="184" cy="150" r="1.6" /><circle cx="130" cy="138" r="1.4" /></g>
    </> : <>
      <path d="M232 168 c0-26 56-26 56 0z" fill="var(--burrow)" />
      <Bunny x={260} y={176} peek />
      <path d="M232 168 c0-26 56-26 56 0z" fill="var(--burrow)" opacity=".35" />
      <g className="foxg"><g transform="translate(70 150)">
        <g className="tail"><path d="M-8 -10 C-44 -26 -52 -2 -34 8 C-24 12 -14 6 -8 -4z" fill="#c95f43" /><path d="M-34 8 C-42 2 -46 -8 -40 -14 C-50 -6 -46 6 -34 8z" fill="#fdfdf8" /></g>
        <ellipse cx="12" cy="-12" rx="28" ry="15" fill="#c95f43" /><path d="M-4 0 v14 M22 0 v14 M8 0 v14" stroke="#3b2a20" strokeWidth="4" strokeLinecap="round" />
        <path d="M32 -22 L38 -42 L48 -26z" fill="#c95f43" /><path d="M38 -22 L48 -40 L52 -22z" fill="#c95f43" />
        <path d="M30 -24 C36 -34 56 -34 66 -22 L72 -16 L58 -8 C46 -6 34 -10 30 -24z" fill="#c95f43" /><path d="M58 -8 L72 -16 L64 -4z" fill="#fdfdf8" /><circle cx="73" cy="-16" r="2.4" fill="#3b2a20" /><circle cx="52" cy="-22" r="2" fill="#3b2a20" />
      </g></g>
    </>}
  </svg>;
}
