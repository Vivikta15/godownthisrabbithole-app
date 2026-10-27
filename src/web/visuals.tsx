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
