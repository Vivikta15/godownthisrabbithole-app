import React, { useMemo } from 'react';
import type { MascotState } from '../shared/mascot';

// Flat gouache scenery in the spirit of Paco Yao's summer paintings: a sky seen through hanging leaf canopies, a turquoise pond with swans, a bright field.
// Everything is drawn in code (solid shapes, cream leaf outlines, small darker leaf dabs) so it stays crisp at any size and can sway with the wind.

const rng = (s: number) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const f = (n: number) => n.toFixed(1);
const LEAF = ['#86c63f', '#72b533', '#98d24a', '#63a82c'], DAB = ['#3f8f2d', '#2f7a2c', '#b4e06a', '#4da032'], RIM = '#e8f0b4', BRANCH = '#3a4a26';

// A hanging clump of leaves: cream rim first (so neighbouring blobs share one outline), then the green blobs, then darker leaf dabs and a few branches.
export function canopy(seed: number, key: string, cx: number, cy: number, R: number, n = 15) {
  const r = rng(seed);
  const blobs = Array.from({ length: n }, () => { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.72; return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.85, rx: R * (0.2 + r() * 0.16), ry: R * (0.16 + r() * 0.13), rot: r() * 180, c: LEAF[Math.floor(r() * LEAF.length)] }; });
  const dabs = Array.from({ length: n * 2 }, () => { const b = blobs[Math.floor(r() * blobs.length)]; return { x: b.x + (r() - 0.5) * b.rx * 1.2, y: b.y + (r() - 0.5) * b.ry * 1.2, rot: r() * 180, c: DAB[Math.floor(r() * DAB.length)], s: 0.8 + r() * 0.9 }; });
  const limbs = Array.from({ length: 3 }, () => { const a = r() * Math.PI * 2; return `M${f(cx + Math.cos(a) * R * 0.95)} ${f(cy + Math.sin(a) * R * 0.8)} Q${f(cx + Math.cos(a) * R * 0.4 + (r() - 0.5) * 30)} ${f(cy + Math.sin(a) * R * 0.3)} ${f(cx)} ${f(cy)}`; });
  return <g key={key} className="sw" style={{ animationDelay: `${(-r() * 6).toFixed(1)}s`, ['--k' as string]: 0.9 }}>
    {limbs.map((d, i) => <path key={'l' + i} d={d} fill="none" stroke={BRANCH} strokeWidth={7} strokeLinecap="round" opacity=".85" />)}
    {blobs.map((b, i) => <ellipse key={'o' + i} cx={f(b.x)} cy={f(b.y)} rx={f(b.rx + 9)} ry={f(b.ry + 9)} transform={`rotate(${f(b.rot)} ${f(b.x)} ${f(b.y)})`} fill={RIM} />)}
    {blobs.map((b, i) => <ellipse key={'g' + i} cx={f(b.x)} cy={f(b.y)} rx={f(b.rx)} ry={f(b.ry)} transform={`rotate(${f(b.rot)} ${f(b.x)} ${f(b.y)})`} fill={b.c} />)}
    {dabs.map((d, i) => <ellipse key={'d' + i} cx={f(d.x)} cy={f(d.y)} rx={f(13 * d.s)} ry={f(5.5 * d.s)} transform={`rotate(${f(d.rot)} ${f(d.x)} ${f(d.y)})`} fill={d.c} opacity=".85" />)}
  </g>;
}

export const swan = (k: string, x: number, y: number, s: number, flip: boolean, dur: number, delay: number) => (
  <g key={k} className={flip ? 'swan l' : 'swan'} style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx="0" cy="6" rx="34" ry="6" fill="#0d6f75" opacity=".35" />
      <path d="M-30 0 Q-34 -14 -14 -16 Q10 -18 28 -8 Q34 -4 30 2 Q10 10 -16 8 Q-30 6 -30 0Z" fill="#fffdf6" />
      <path d="M-4 -14 Q-12 -26 -8 -40 Q-6 -52 6 -52" fill="none" stroke="#fffdf6" strokeWidth="9" strokeLinecap="round" />
      <path d="M6 -53 l11 3 l-11 5z" fill="#f4a63a" />
      <circle cx="4" cy="-52" r="1.6" fill="#33403a" />
      <path d="M-24 -4 Q-8 -10 14 -4" fill="none" stroke="#dfe9e6" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  </g>);

export function PacoScene() {
  const s = useMemo(() => {
    const r = rng(7);
    const blades = Array.from({ length: 90 }, (_, i) => { const x = -80 + i * 20 + r() * 16, y = 868 + r() * 40, h = 40 + r() * 70; return <path key={i} className="bl" style={{ animationDelay: `${(-r() * 5).toFixed(1)}s` }} d={`M${f(x)} ${f(y)}q${f((r() - 0.5) * 14)} ${f(-h * 0.55)} ${f((r() - 0.3) * 26)} ${f(-h)}`} stroke={['#6fb52b', '#4f9a22', '#9ed14a', '#2f7d2a'][i % 4]} />; });
    const ripples = Array.from({ length: 26 }, (_, i) => { const x = r() * 1600, y = 560 + r() * 150, w = 24 + r() * 50; return <path key={i} className="rip" style={{ animationDelay: `${(-r() * 6).toFixed(1)}s` }} d={`M${f(x)} ${f(y)}q${f(w / 4)} -5 ${f(w / 2)} 0t${f(w / 2)} 0`} />; });
    const flowers = Array.from({ length: 24 }, (_, i) => <g key={i} transform={`translate(${f(r() * 1600)} ${f(820 + r() * 70)})`}>{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-4" rx="2.4" ry="4.4" transform={`rotate(${a})`} fill={i % 3 ? '#fffaf0' : '#f4d44a'} />)}<circle r="2" fill="#f0a62a" /></g>);
    return { blades, ripples, flowers };
  }, []);
  return <svg className="mscene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="p-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--s1)' }} /><stop offset=".6" style={{ stopColor: 'var(--s2)' }} /><stop offset="1" style={{ stopColor: 'var(--s3)' }} /></linearGradient>
      <linearGradient id="p-lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#35c1b8" /><stop offset=".55" stopColor="#14a39f" /><stop offset="1" stopColor="#0c8a8e" /></linearGradient>
      <linearGradient id="p-field" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a6d84a" /><stop offset="1" stopColor="#74b82e" /></linearGradient>
    </defs>
    <rect x="-200" y="-200" width="2000" height="1300" fill="url(#p-sky)" />
    <g className="ly" style={{ ['--d' as string]: 0.3 }}>
      {[[260, 250, 1.5], [1180, 170, 1.1], [760, 120, 0.8], [1450, 400, 1.2]].map(([x, y, k], i) => <g key={i} className={'cl ' + ['c-a', 'c-b', 'c-c', 'c-a'][i]} style={{ animationDelay: `${-i * 7}s` }}><g fill="#ffffff" opacity=".92"><ellipse cx={x} cy={y} rx={120 * k} ry={38 * k} /><ellipse cx={x + 70 * k} cy={y - 24 * k} rx={78 * k} ry={34 * k} /><ellipse cx={x - 80 * k} cy={y - 14 * k} rx={64 * k} ry={28 * k} /></g></g>)}
    </g>
    <g className="ly" style={{ ['--d' as string]: 0.6 }}>
      <path d="M-120 560 Q200 540 520 556 T1200 548 T1720 560 V760 H-120Z" fill="url(#p-lake)" />
      <path d="M-120 560 Q200 540 520 556 T1200 548 T1720 560" fill="none" stroke="#bff0e2" strokeWidth="6" opacity=".7" />
      <g className="ripples" fill="none" stroke="#d8fff4" strokeWidth="3" strokeLinecap="round">{s.ripples}</g>
      {swan('s1', 380, 640, 1.2, false, 22, 0)}{swan('s2', 560, 690, 1, true, 28, -9)}{swan('s3', 900, 620, 0.8, false, 25, -4)}{swan('s4', 1130, 670, 1.1, true, 30, -14)}{swan('s5', 250, 700, 0.9, false, 26, -18)}
    </g>
    <g className="ly" style={{ ['--d' as string]: 1 }}>
      <path d="M-120 720 C200 650 520 730 860 760 S1360 700 1720 740 V1000 H-120Z" fill="url(#p-field)" />
      <path d="M520 1000 C600 900 640 820 700 740" fill="none" stroke="#5aa026" strokeWidth="26" opacity=".35" strokeLinecap="round" />
      {s.flowers}<g className="blades" fill="none" strokeWidth="5" strokeLinecap="round">{s.blades}</g>
    </g>
    <g className="ly" style={{ ['--d' as string]: 1.7 }}>
      {canopy(11, 'tl', 120, 40, 330, 20)}{canopy(23, 'tr', 1500, 20, 360, 22)}{canopy(5, 'tm', 800, -90, 230, 12)}{canopy(31, 'lm', -60, 420, 230, 12)}{canopy(41, 'rm', 1690, 460, 250, 13)}
    </g>
    <g className="ly" style={{ ['--d' as string]: 1.2 }}>
      {/* Keep placement on a parent: CSS wing transforms must never replace a bird's SVG position. */}
      <g className="flock">{[[0, 0], [38, 16], [-34, 20], [70, 36], [-66, 40]].map(([x, y], i) => <g key={i} transform={`translate(${760 + x} ${300 + y})`}><path className="bird" style={{ animationDelay: `${-i * 0.23}s` }} d="M0 0q6-7 12 0q6-7 12 0" /></g>)}</g>
    </g>
  </svg>;
}

// The rabbit: white, round-headed, in a straw hat, holding a pink cosmos. Eyes are two small dark dots that blink; the flower sways, the ear twitches.
export function PacoBunny({ state, pupils, head, ears }: { state: MascotState; pupils: React.RefObject<SVGGElement | null>; head: React.RefObject<SVGGElement | null>; ears: React.RefObject<SVGGElement | null> }) {
  const reading = state === 'reading', ink = '#2b2a2e', shade = '#dfe3ee', fur = '#fdfcf8';
  return <svg viewBox="0 0 140 170" width="100%" height="100%" aria-hidden="true">
    <ellipse cx="68" cy="160" rx="52" ry="8" fill="#2c6a1c" opacity=".4" />
    <g className="bb"><g className="rb">
      <circle cx="34" cy="146" r="8" fill={fur} />
      <path d="M40 150 C28 130 34 108 52 100 L88 100 C106 108 110 132 98 150 Z" fill={fur} />
      <path d="M88 100 C106 108 110 132 98 150 L88 150 C96 132 92 112 84 102Z" fill={shade} opacity=".8" />
      <ellipse cx="58" cy="154" rx="9" ry="4.6" fill={ink} /><ellipse cx="86" cy="154" rx="9" ry="4.6" fill={ink} />
      {reading && <g className="tab"><rect x="52" y="116" width="34" height="24" rx="5" fill="#d9f3ee" fillOpacity=".85" stroke="#fff" strokeWidth="1.6" /><path d="M58 124h22M58 130h15" stroke="#14a39f" strokeWidth="2.2" strokeLinecap="round" /></g>}
      <g className="flowerarm" style={{ display: reading ? 'none' : undefined }}>
        <path d="M92 112 Q108 106 110 84" fill="none" stroke={fur} strokeWidth="9" strokeLinecap="round" /><path d="M92 112 Q108 106 110 84" fill="none" stroke={shade} strokeWidth="3" strokeLinecap="round" opacity=".6" />
        <g className="flower"><path d="M110 84 Q114 66 118 54" fill="none" stroke="#3f9a2b" strokeWidth="3" strokeLinecap="round" /><path d="M114 70 q8 -3 11 3 q-8 3 -11 -3z" fill="#4fae34" />
          <g transform="translate(119 48)">{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <ellipse key={a} cx="0" cy="-8" rx="4.6" ry="8.4" transform={`rotate(${a})`} fill="#ec3f7b" />)}<circle r="4.2" fill="#f5a623" /></g></g>
      </g>
      <g ref={head} className="hd">
        <g ref={ears}>
          <g transform="rotate(-26 46 54)"><g className="ear e1"><ellipse cx="46" cy="38" rx="10" ry="21" fill={fur} /><ellipse cx="46" cy="40" rx="5.4" ry="14.5" fill="#f2a6a6" /></g></g>
          <g transform="rotate(16 90 50)"><g className="ear e2"><ellipse cx="90" cy="34" rx="9.5" ry="21" fill={fur} /><path d="M96 20 q4 12 -2 30 q8 -10 6 -26z" fill={shade} opacity=".7" /></g></g>
        </g>
        <ellipse cx="68" cy="82" rx="35" ry="30" fill={fur} />
        <path d="M92 62 C104 76 100 98 80 108 C96 96 98 76 88 62Z" fill={shade} opacity=".75" />
        <g className="hat"><ellipse cx="68" cy="56" rx="44" ry="11" fill="#dba865" /><path d="M42 54 C44 30 92 30 94 54 C80 60 56 60 42 54Z" fill="#cd9244" /><path d="M42 54 C56 60 80 60 94 54 L93 49 C80 55 56 55 43 49Z" fill="#b57634" />
          <path d="M30 56 q8 5 18 6M104 56 q-8 5 -18 6M56 40 q12 -4 24 0" stroke="#e9c58b" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".7" /></g>
        {reading ? <g stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round"><path d="M52 82q4 3.500 8 0" /><path d="M76 82q4 3.500 8 0" /></g>
          : <g className="eyes"><circle className="blink" cx="58" cy="82" r="2.900" fill={ink} /><circle className="blink" cx="80" cy="82" r="2.900" fill={ink} /><g ref={pupils} /></g>}
        <ellipse cx="50" cy="90" rx="6" ry="4" fill="#f6a8a4" opacity=".75" /><ellipse cx="88" cy="90" rx="6" ry="4" fill="#f6a8a4" opacity=".75" />
        <path d="M65 90 q4 4 8 0" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
      {(state === 'greet' || state === 'cheer') && <ellipse className="wave" cx="40" cy="116" rx="6" ry="12" fill={fur} />}
      {state === 'finder_think' && <text className="q" x="102" y="28" fontSize="26" fontFamily="Baloo 2 Variable, sans-serif" fontWeight="700" fill="#14a39f">?</text>}
      {state === 'finder_found' && <path className="q" d="M110 36l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#f4c64e" />}
    </g></g>
  </svg>;
}
